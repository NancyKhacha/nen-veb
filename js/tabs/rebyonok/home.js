// «Ребёнок» — дашборд (экраны 1–3, 13, 16–18, 20, 21): блок на каждый раздел, под названием — факт о ребёнке.
// Порядок один для всех: Дневник, Здоровье, Рост, Развитие, Моменты, Сказки и звуки, в первый год — Документы.
import { html } from '../../lib.js?v=24';
import { useStore, update, now, activeChild } from '../../store.js?v=24';
import { Header, Row, SecTitle, Avatar } from '../../ui.js?v=24';
import { DAY, startOfDay, dateLong, hhmm, ageMonths, isPreterm, dayKey, expectingLine } from '../../age.js?v=24';
import { articlesFor } from '../../content/articles.js?v=24';
import { go } from '../../router.js?v=24';
import { track } from '../../stats.js?v=24';
import { bornChild, nameOf, WeekStrip, BlockTitle, FeedCard, lastDoneVaccine, vaccineGroups, vaccineSub, measures, measureLine, illness,
  momentsOf, memory, monthBirthday, ageWords, inFirstYear, cap } from './util.js?v=24';
import { lastSeen, currentSheet, sheetGen } from './razvitie.js?v=24';
import { MomentCard, openNewMoment } from './momenty.js?v=24';
import { talesFav } from './skazki.js?v=24';
import { docsLine } from './zdorovye.js?v=24';
import { TodayTiles } from './istoriya.js?v=24';
import { FamilyNudge } from '../../semya.js?v=24';
import { quickTypes, sectionOn, stageFor, prefsOf } from '../../stages.js?v=24';
import { sadLine, schoolLine, clubsLine, docsCount, checkupNow } from './etapy.js?v=24';
import { STAGE_NOTES, DOCS } from '../../content/etapy.js?v=24';
import { KidsBar } from '../../ui.js?v=24';
import { POST_BIRTH as POST } from '../../content/rebyonok-spravka.js?v=24';

// Переключатель близнецов — без «Оба»: история у каждого своя
function TwinPills({ child, s }) {
  const twin = child.twinOf && s.children.find((c) => c.id === child.twinOf);
  if (!twin) return null;
  const pick = (id) => { track('ребёнок:близнец'); update((d) => { d.activeChildId = id; }); };
  const pair = s.children.filter((c) => c.id === child.id || c.id === twin.id);
  return html`<div class="pills">${pair.map((c) => html`<button class=${'pill' + (c.id === child.id ? ' on' : '')} onClick=${() => pick(c.id)}>${nameOf(c)}</button>`)}</div>`;
}

// Плитка «Здоровье» — та же логика, что была у блока: болеет → последний визит или прививка → первая прививка
function health(child, s, t, ill, last) {
  const to = '/rebyonok/zdorovye';
  if (ill) return { k: 'здоровье', l: 'Здоровье', v: 'Болеет', sub: `с ${dateLong(ill.from)}` + (ill.temp ? ` · ${ill.temp.data.t}° в ${hhmm(ill.temp.start)}` : '') + (ill.med ? ` · ${ill.med.data.name}` : ''), to: '/rebyonok/zdorovye/bolezni' };
  const visit = (s.tasks || []).filter((x) => x.childId === child.id && (x.kind === 'doctor' || x.kind === 'tests') && x.done).sort((a, b) => b.done - a.done)[0];
  if (visit && (!last || visit.done > last.doneAt)) return { k: 'здоровье', l: 'Здоровье', v: visit.title, sub: `${visit.title.startsWith('Осмотр') ? 'был' : 'были'} ${dateLong(visit.done)}`, to };
  if (last) return { k: 'здоровье', l: 'Здоровье', v: last.title, sub: vaccineSub(child, last) + (last.age && isPreterm(child) ? ' — по дате рождения' : ''), to };
  const first = vaccineGroups(child, s)[0];
  return t - child.dob < 60 * DAY && first
    ? { k: 'здоровье', l: 'Здоровье', v: first.title, sub: 'отметьте, если сделали', to }
    : { k: 'здоровье', l: 'Здоровье', v: 'Прививки и осмотры', sub: 'отметьте сделанные', to };
}
function MomentsBlock({ child, s }) {
  const t = now();
  const list = momentsOf(child, s);
  const mem = memory(child, s, t);
  const mb = monthBirthday(child, t);
  const todayMonth = list.find((m) => m.month && startOfDay(m.at) === startOfDay(t));
  const cards = [];
  if (mb && !todayMonth) cards.push(html`<${FeedCard} key="month" ill="＋ Фото" label=${`Сегодня ${ageWords(mb)}`} title="Фото месяца" onClick=${() => { track('моменты:фото-месяца'); openNewMoment(child, { text: `${nameOf(child)} в ${ageWords(mb)}`, month: true }); }} />`);
  if (mem) cards.push(html`<${MomentCard} key=${'mem' + mem.moment.id} m=${mem.moment} label=${mem.label} />`);
  for (const m of list.slice(0, 6)) if (!mem || m.id !== mem.moment.id) cards.push(html`<${MomentCard} key=${m.id} m=${m} label=${todayMonth && m.id === todayMonth.id ? 'Фото месяца' : undefined} />`);
  return html`
    <${BlockTitle} more="Все" to="/rebyonok/momenty" ev="моменты">Моменты<//>
    ${cards.length ? html`<div class="feed">${cards.slice(0, 7)}</div>`
      : html`<div class="rows"><${Row} title="Что хочется запомнить?" sub="Первый момент — без подготовки и особого повода" onClick=${() => openNewMoment(child)} /></div>`}`;
}

function TalesBlock({ child, s }) {
  const m = ageMonths(child, now());
  const fav = talesFav(s);
  const title = m < 1 ? 'Колыбельные и белый шум' : m < 12 ? 'Колыбельные и белый шум' : m < 36 ? 'Потешки и колыбельные' : m < 60 ? 'Сказки для 3–5 лет' : 'Сказки для 5–7 лет';
  const sub = fav ? `В избранном ${fav}` : m < 1 ? 'Для первых недель' : 'Шум — одним касанием, играет и без сети';
  return html`
    <${BlockTitle} more=${m >= 36 ? 'Все сказки' : 'Все'} to="/rebyonok/skazki" ev="сказки">Сказки и звуки<//>
    <div class="rows"><${Row} title=${title} sub=${sub} onClick=${() => go('/rebyonok/skazki')} /></div>`;
}

// Плитки разделов — как виджеты May Baby: что было последним и куда нажать (журнал, 5 ноября)
function InfoTiles({ child, s }) {
  const t = now();
  const last = measures(child, s)[0];
  const lastVac = lastDoneVaccine(child, s);
  const ill = illness(child, s, t);
  const seen = lastSeen(child, s);
  const m = ageMonths(child, t);
  const sheet = m >= 2 && sectionOn('development', m) ? currentSheet(m) : null;
  // Плитки — по возрасту (stages.js): до трёх лет — рост, здоровье, развитие; дальше на первый план
  // выходят сад, кружки и школа; у школьника развития по ориентирам и сада нет
  const T = {
    rost: { k: 'рост', l: 'Рост', v: last ? measureLine(last, ', ') : 'Первый замер', sub: last ? (startOfDay(last.start) === startOfDay(t) ? 'сегодня' : dateLong(last.start)) : (m < 36 ? 'вес, рост, голова' : 'вес и рост'), to: '/rebyonok/rost' },
    health: (() => {
      const c = checkupNow(child, t); const h0 = health(child, s, t, ill, lastVac);
      const h = c && !ill ? { ...h0, v: c.title, sub: c.note || 'кого пройти — в «Здоровье»' } : h0;
      const al = ((((s.rebyonok || {}).med || {})[child.id] || {}).allergy || []);
      return al.length ? { ...h, sub: 'аллергия: ' + al.map((x) => x.text).join(', ') } : h;
    })(),
    dev: sectionOn('development', m)
      ? { k: 'развитие', l: 'Развитие', v: seen ? seen.it.ru : sheet ? sheet.items[0].ru : 'Первые недели', sub: (seen ? `видели ${dateLong(seen.at)}` : sheet ? 'отметьте, когда увидите' : 'ориентиры — к 2 месяцам') + (isPreterm(child) && m < 24 && sheet ? ` · ориентиры ${sheetGen(sheet)}` : ''), to: '/rebyonok/razvitie' }
      : null,
    toSchool: sectionOn('toSchool', m) ? { k: 'к-школе', l: 'К школе', v: 'Готовность и запись', sub: 'по шагам и почитать', to: '/rebyonok/shkola' } : null,
    sad: sectionOn('sad', m) ? { k: 'сад', l: 'Детский сад', ...sadLine(child, s), to: '/rebyonok/sad' } : null,
    clubs: sectionOn('clubs', m) ? { k: 'кружки', l: 'Кружки', ...clubsLine(child, s, t), to: '/rebyonok/kruzhki' } : null,
    school: sectionOn('school', m) ? { k: 'школа', l: 'Школа', ...schoolLine(child, s), to: '/rebyonok/shkola' } : null,
    docs: { k: 'документы', l: 'Документы', v: docsCount(child, s) ? `Есть ${docsCount(child, s)} из ${DOCS.length}` : 'Всё в одном месте', sub: 'СНИЛС, полис, медкарта, справки', to: '/rebyonok/vse-dokumenty' },
    diary: { k: 'дневник', l: 'Дневник', v: 'По дням', sub: 'что было и что в планах', to: '/rebyonok/dnevnik' },
  };
  const order = m < 36 ? ['rost', 'health', 'dev', 'diary', 'sad', 'clubs', 'docs']
    : m < 84 ? ['health', 'sad', 'clubs', 'school', 'dev', 'rost', 'diary', 'docs']
    : ['school', 'clubs', 'health', 'rost', 'diary', 'docs'];
  const seenK = new Set();
  const tiles = order.map((k) => T[k]).filter((x) => x && !seenK.has(x.k) && seenK.add(x.k));
  return html`
    <div class="rb-tiles two">
      ${tiles.map((x) => html`
        <div class="rb-tile">
          <button class="rb-tile-main" onClick=${() => { track('ребёнок:плитка-' + x.k); go(x.to); }}>
            <span class="l">${x.l}</span><b class="txt">${x.v}</b><span class="s">${x.sub}</span>
          </button>
        </div>`)}
    </div>`;
}

function Dashboard({ child, s }) {
  const t = now();
  const m = ageMonths(child, t);
  const quick = quickTypes(m, prefsOf(s, child)).filter((x) => !(s.settings.hiddenButtons || []).includes(x));
  const st = stageFor(child, t);
  return html`
    ${s.children.length > 1 ? '' : html`<${TwinPills} child=${child} s=${s} />`}
    ${STAGE_NOTES[st.key] && html`<p class="small rb-stage">${STAGE_NOTES[st.key]}</p>`}
    ${quick.length > 0 && html`<${TodayTiles} child=${child} types=${quick} />`}
    <${InfoTiles} child=${child} s=${s} />
    <${BlockTitle} more="Вся неделя" to="/rebyonok/dnevnik?vid=nedelya" ev="дневник">Неделя<//>
    <${WeekStrip} child=${child} onPick=${(d) => { track('ребёнок:день'); go('/rebyonok/dnevnik?den=' + dayKey(d)); }} />
    <${FamilyNudge} s=${s} />
    <${MomentsBlock} child=${child} s=${s} />
    ${sectionOn('tales', m) && html`<${TalesBlock} child=${child} s=${s} />`}
    ${inFirstYear(child, t) && (() => { const d = docsLine(child, s); return html`
      <${BlockTitle} more="Все дела" to="/rebyonok/dokumenty" ev="документы">Документы после рождения<//>
      <div class="rows"><${Row} title=${d.title} sub=${d.sub} onClick=${() => go('/rebyonok/dokumenty')} /></div>`; })()}`;
}

// Пока ждут малыша — три строки (отдельный бриф «Беременность и ребёнок»)
function Expecting({ child }) {
  return html`
    <h1 class="h1">${nameOf(child) === 'Ребёнок' ? 'Малыш' : nameOf(child)}</h1>
    <p class="small">${expectingLine(child.due, now())}</p>
    <div class="rows">
      <${Row} title="Подготовка к родам" sub="Материалы НЭН — что взять, как всё бывает, что потом" onClick=${() => { track('ребёнок:ждём-роды'); go('/rebyonok/zhdyom'); }} />
      <${Row} title="Выбираем имя" sub="Имя — в карточке малыша, его увидят все экраны" onClick=${() => { track('ребёнок:ждём-имя'); go('/profil/rebyonok/' + child.id); }} />
      <${Row} title="Малыш родился" sub="Дата рождения — и «Ребёнок» откроется целиком" onClick=${() => { track('ребёнок:родился'); go('/profil/rebyonok/' + child.id); }} />
    </div>
    <${SecTitle}>Уже сейчас<//>
    <div class="rows">
      <${Row} title="Сказки и звуки" sub="Колыбельные текстом и шум — пригодятся с первых дней" onClick=${() => go('/rebyonok/skazki')} />
      <${Row} title="Документы после рождения" sub="Восемь дел первого года — что и когда оформить" onClick=${() => go('/rebyonok/dokumenty-zhdyom')} />
    </div>`;
}

function Home() {
  const s = useStore();
  const any = activeChild(s);
  const child = bornChild(s);
  return html`
    <div class="screen">
      <${Header} />
      ${s.children.length > 1 && html`<${KidsBar} />`}
      ${child ? html`<${Dashboard} child=${child} s=${s} />`
        : any && any.expecting ? html`<${Expecting} child=${any} />`
        : html`
          <h1 class="h1">Ребёнок</h1>
          <p class="lead">Здесь будут дни ребёнка, здоровье, рост, развитие, моменты, сказки и звуки.</p>
          <button class="btn btn-primary" onClick=${() => go('/profil/rebyonok/novyy')}>Добавить ребёнка</button>
          <p class="small">Или малыша, которого ждёте.</p>`}
    </div>`;
}

// Подготовка к родам — статьи НЭН для тех, кто ждёт
function Waiting() {
  const s = useStore();
  const list = articlesFor({ stage: 'expecting', topics: s.topics || [] }).filter((a) => a.fromM === -1).slice(0, 20);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Подготовка к родам</h1>
      <div class="rows">${list.map((a) => html`<${Row} key=${a.id} title=${a.title} sub=${a.section || ''} onClick=${() => { track('ребёнок:статья'); go('/statya/' + a.id); }} />`)}</div>
    </div>`;
}
// Документы до рождения — только список, отметки появятся после
function DocsPreview() {
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Документы после рождения</h1>
      <p class="small">Отмечать сделанное можно будет, когда малыш родится. Пока — что и когда понадобится.</p>
      <div class="rows">${POST.map((d) => html`<${Row} key=${d.id} chev=${false} title=${d.title} sub=${d.deadline} />`)}</div>
    </div>`;
}
export const homeRoutes = [
  { path: '/rebyonok', view: Home, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zhdyom', view: Waiting, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/dokumenty-zhdyom', view: DocsPreview, tab: '/rebyonok', strip: true },
];
