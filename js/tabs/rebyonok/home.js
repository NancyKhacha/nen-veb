// «Ребёнок» — дашборд (экраны 1–3, 13, 16–18, 20, 21): блок на каждый раздел, под названием — факт о ребёнке.
// Порядок один для всех: Дневник, Здоровье, Рост, Развитие, Моменты, Сказки и звуки, в первый год — Документы.
import { html } from '../../lib.js';
import { useStore, update, now, activeChild } from '../../store.js';
import { Header, Row, SecTitle, Avatar } from '../../ui.js';
import { DAY, startOfDay, dateLong, hhmm, ageMonths, isPreterm, dayKey, expectingLine } from '../../age.js';
import { articlesFor } from '../../content/articles.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import { bornChild, nameOf, WeekStrip, BlockTitle, FeedCard, lastDoneVaccine, vaccineGroups, vaccineSub, measures, measureLine, illness,
  momentsOf, memory, monthBirthday, ageWords, inFirstYear, cap } from './util.js';
import { lastSeen, currentSheet, sheetGen } from './razvitie.js';
import { MomentCard, openNewMoment } from './momenty.js';
import { talesFav } from './skazki.js';
import { docsLine } from './zdorovye.js';
import { TodayTiles } from './istoriya.js';
import { FamilyNudge } from '../../semya.js';
import { POST_BIRTH as POST } from '../../content/rebyonok-spravka.js';

// Переключатель близнецов — без «Оба»: история у каждого своя
function TwinPills({ child, s }) {
  const twin = child.twinOf && s.children.find((c) => c.id === child.twinOf);
  if (!twin) return null;
  const pick = (id) => { track('ребёнок:близнец'); update((d) => { d.activeChildId = id; }); };
  const pair = s.children.filter((c) => c.id === child.id || c.id === twin.id);
  return html`<div class="pills">${pair.map((c) => html`<button class=${'pill' + (c.id === child.id ? ' on' : '')} onClick=${() => pick(c.id)}>${nameOf(c)}</button>`)}</div>`;
}

function HealthBlock({ child, s }) {
  const t = now();
  const ill = illness(child, s, t);
  const pre = isPreterm(child) ? ' — по дате рождения' : '';
  let rows;
  if (ill) {
    rows = html`
      <${Row} title=${`Болеет с ${dateLong(ill.from)}`} sub=${ill.temp ? `Последняя температура ${ill.temp.data.t} в ${hhmm(ill.temp.start)}` : 'Записать температуру — «Другая запись»'} onClick=${() => go('/rebyonok/zdorovye/bolezni')} />
      ${ill.med && html`<${Row} title=${ill.med.data.name} sub=${`Последний приём в ${hhmm(ill.med.start)}`} onClick=${() => go('/rebyonok/zdorovye/bolezni')} />`}`;
  } else {
    const last = lastDoneVaccine(child, s);
    const visit = (s.tasks || []).filter((x) => x.childId === child.id && (x.kind === 'doctor' || x.kind === 'tests') && x.done).sort((a, b) => b.done - a.done)[0];
    if (visit && (!last || visit.done > last.doneAt)) rows = html`<${Row} title=${visit.title} sub=${`Был${visit.title.startsWith('Осмотр') ? '' : 'и'} ${dateLong(visit.done)}`} onClick=${() => go('/rebyonok/zdorovye')} />`;
    else if (last) rows = html`<${Row} title=${last.title} sub=${vaccineSub(child, last) + (last.age ? pre : '')} onClick=${() => go('/rebyonok/zdorovye')} />`;
    else {
      const first = vaccineGroups(child, s)[0];
      const young = t - child.dob < 60 * DAY;
      rows = young ? html`<${Row} title=${first.title} sub="Отметьте, если сделали" onClick=${() => go('/rebyonok/zdorovye')} />`
        : html`<${Row} title="Прививки и осмотры" sub="Отметьте сделанные — они останутся с датой" onClick=${() => go('/rebyonok/zdorovye')} />`;
    }
  }
  return html`<${BlockTitle} more="Вся медкарта" to="/rebyonok/zdorovye" ev="здоровье">Здоровье<//><div class="rows">${rows}</div>`;
}

function GrowthBlock({ child, s }) {
  const last = measures(child, s)[0];
  const t = now();
  const when = last ? (startOfDay(last.start) === startOfDay(t) ? 'Замер сегодня' : `Замер ${dateLong(last.start)}`) : '';
  return html`
    <${BlockTitle} more="Все замеры" to="/rebyonok/rost" ev="рост">Рост<//>
    <div class="rows">${last ? html`<${Row} title=${measureLine(last, ' и ')} sub=${when} onClick=${() => go('/rebyonok/rost')} />`
      : html`<${Row} title="Первое измерение" sub="Запишите вес, рост или окружность головы" onClick=${() => go('/rebyonok/rost')} />`}</div>`;
}

function DevBlock({ child, s }) {
  const t = now();
  const m = ageMonths(child, t);
  const seen = lastSeen(child, s);
  const pre = isPreterm(child) && m < 24;
  let row;
  if (seen) row = html`<${Row} title=${seen.it.ru} sub=${`Видели ${dateLong(seen.at)}${pre ? ' · ориентиры ' + sheetGen(currentSheet(Math.max(0, m))) : ''}`} onClick=${() => go('/rebyonok/razvitie')} />`;
  else if (m < 2) row = html`<${Row} title="Первые ориентиры — к 2 месяцам" sub="Пока — занятия для первых недель" onClick=${() => go('/rebyonok/razvitie')} />`;
  else { const sh = currentSheet(m); row = html`<${Row} title=${sh.items[0].ru} sub=${`Отметьте, когда увидите${pre ? ' · ориентиры ' + sheetGen(sh) : ''}`} onClick=${() => go('/rebyonok/razvitie')} />`; }
  return html`<${BlockTitle} more=${seen || m >= 2 ? 'Все ориентиры' : 'Все'} to="/rebyonok/razvitie" ev="развитие">Развитие<//><div class="rows">${row}</div>`;
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

function Dashboard({ child, s }) {
  const t = now();
  return html`
    <${TwinPills} child=${child} s=${s} />
    <${BlockTitle} more="Вся неделя" to="/rebyonok/dnevnik?vid=nedelya" ev="дневник">Дневник<//>
    <${TodayTiles} child=${child} types=${ageMonths(child, t) < 12 ? ['sleep', 'feed', 'diaper'] : ['sleep', 'food', 'potty']} />
    <${WeekStrip} child=${child} onPick=${(d) => { track('ребёнок:день'); go('/rebyonok/dnevnik?den=' + dayKey(d)); }} />
    <${FamilyNudge} s=${s} />
    <${HealthBlock} child=${child} s=${s} />
    <${GrowthBlock} child=${child} s=${s} />
    <${DevBlock} child=${child} s=${s} />
    <${MomentsBlock} child=${child} s=${s} />
    <${TalesBlock} child=${child} s=${s} />
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
      <div class="rows">${list.map((a) => html`<${Row} key=${a.id} title=${a.title} sub=${a.section || 'НЭН'} onClick=${() => { track('ребёнок:статья'); go('/statya/' + a.id); }} />`)}</div>
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
