// Профиль родителя — всё служебное: дети, темы, кнопки записи, копия, вход, «Для исследования».
import { html, useState } from './lib.js?v=23';
import { useStore, update, uid, getState, resetAll, savePhoto, now, storage } from './store.js?v=23';
import { parseDate, maskDate, ageText, expectingLine, startOfDay, ddmmyyyy, childAgeLine } from './age.js?v=23';
import { go, back, current } from './router.js?v=23';
import { Back, Row, SecTitle, Pill, Field, Avatar, toast, confirmAction, GestStepper } from './ui.js?v=23';
import { TOPICS, Transfer, startPreview, genitive } from './onboarding.js?v=23';
import { familyLine } from './semya.js?v=23';
import { TodayTiles } from './tabs/rebyonok/istoriya.js?v=23';
import { quickTypes, recordAllowed, prefsOf } from './stages.js?v=23';
import { ageMonths } from './age.js?v=23';
import { statsReport, statsCode, resetStats, track } from './stats.js?v=23';
import { describe } from './records.js?v=23';

function Profile() {
  const s = useStore();
  return html`
    <div class="screen">
      <${Back} title="Профиль" />
      <${SecTitle}>Дети<//>
      <div class="rows">
        ${s.children.map((c) => html`<${Row} left=${html`<${Avatar} child=${c} />`} title=${c.name || 'Малыш'} sub=${childAgeLine(c)} onClick=${() => go('/profil/rebyonok/' + c.id)} />`)}
        <${Row} title="+ Добавить ребёнка" sub="Или малыша, которого ждёте" onClick=${() => go('/profil/rebyonok/novyy')} />
      </div>
      <${SecTitle}>Семья<//>
      <div class="rows">
        <${Row} title="Вести дневник вместе" sub=${familyLine(s)} onClick=${() => { track('профиль:семья'); go('/profil/semya'); }} />
      </div>
      <${SecTitle}>Приложение<//>
      <div class="rows">
        <${Row} title="Что сейчас волнует" sub=${s.topics.length ? TOPICS.filter(([k]) => s.topics.includes(k)).map(([, l]) => l).join(', ') : 'Темы не выбраны — статьи по возрасту'} onClick=${() => go('/profil/temy')} />
        <${Row} title="Быстрая запись" sub=${(s.settings.hiddenButtons || []).length ? 'Часть кнопок убрана' : 'Сон, кормление, подгузник — как по возрасту'} onClick=${() => go('/profil/knopki')} />
        <${Row} title="Город для погоды" sub=${s.settings.city} onClick=${() => go('/profil/gorod')} />
        <${Row} title="Напоминания" sub="Визиты, прививки, лекарства, заметки, тихие часы" onClick=${() => go('/profil/napominaniya')} />
        <${Row} title="НЭН Плюс" sub="Что даёт подписка и что бесплатно всегда" onClick=${() => go('/profil/plus')} />
        <${Row} title="Копия записей" sub="Файлом — на новый телефон; таблицей — для себя и врача" onClick=${() => go('/profil/kopiya')} />
        <${Row} title="Войти" sub="Для Клуба и Школы НЭН. Дневник работает и без входа" onClick=${() => go('/start/vhod')} />
      </div>
      <${SecTitle}>Проверка<//>
      <div class="rows">
        <${Row} title="Посмотреть первый вход" sub="Пройти его ещё раз, как в первый день. Записи не тронутся" onClick=${startPreview} />
        <${Row} title="Если что-то не работает" sub="Версия, телефон и браузер — чтобы прислать нам" onClick=${() => go('/profil/pomosh')} />
        <${Row} title="Написать в поддержку" sub="support@n-e-n.ru — ответим на почту" onClick=${() => { track('профиль:поддержка'); location.href = 'mailto:support@n-e-n.ru?subject=' + encodeURIComponent('НЭН для родителей — веб-версия'); }} />
        <${Row} title="Для исследования" sub=${`Участник ${statsCode()} · отчёт за неделю`} onClick=${() => go('/profil/issledovanie')} />
      </div>
      <p class="tiny">Пробная веб-версия приложения НЭН. Всё, что вы записываете, хранится только на этом телефоне.</p>
    </div>`;
}

// Карточка ребёнка: правка или новый
const ageMonthsOf = (c) => Math.floor((now() - c.dob) / (30.44 * 864e5));

function ChildCard({ params }) {
  const s = useStore();
  const isNew = params.id === 'novyy';
  const c = isNew ? null : s.children.find((x) => x.id === params.id);
  const [expecting, setExpecting] = useState(c ? !!c.expecting : !!current().query.zhdyom);
  const [name, setName] = useState(c ? c.name || '' : '');
  const [date, setDate] = useState(c ? ddmmyyyy(c.expecting ? c.due : c.dob) : '');
  const [sex, setSex] = useState(c ? c.sex : null);
  const [gest, setGest] = useState(c ? c.gestWeeks || null : null);
  const [photo, setPhoto] = useState(null);
  const [twin, setTwin] = useState(c ? c.twinOf || null : null);
  if (!isNew && !c) return html`<div class="screen"><${Back} /><p class="empty">Такого ребёнка нет.</p></div>`;
  const d = parseDate(date);
  const ok = expecting ? d && d > now() - 14 * 864e5 : name.trim() && d && d <= now();
  const save = async () => {
    const fresh = photo ? await savePhoto(photo) : null;
    const photoId = fresh || (c ? c.photo : null);
    if (photo && !fresh) toast({ text: 'Фото не сохранилось — остальное сохранили. Попробуйте другое фото.', ms: 4000 });
    const id = c ? c.id : uid();
    update((st) => {
      const data = expecting
        ? { id, name: name.trim() || 'Малыш', expecting: true, due: startOfDay(d), photo: photoId }
        : { id, name: name.trim(), dob: startOfDay(d), sex, gestWeeks: gest, photo: photoId, twinOf: twin };
      const i = st.children.findIndex((x) => x.id === id);
      if (i >= 0) st.children[i] = data; else st.children.push(data);
      if (twin) { const t = st.children.find((x) => x.id === twin); if (t) t.twinOf = id; }
      st.activeChildId = id;
      if (!expecting) st.stage = 'born';
    });
    track(isNew ? 'профиль:ребёнок-добавлен' : 'профиль:ребёнок-изменён');
    toast({ text: 'Сохранили', ms: 1800 });
    back('/profil');
  };
  const others = s.children.filter((x) => x.id !== (c && c.id) && !x.expecting);
  return html`
    <div class="screen">
      <${Back} title=${isNew ? 'Новый ребёнок' : (c.name || 'Малыш')} />
      ${!isNew && !c.expecting && html`
        <div class="child-top"><${Avatar} child=${c} /><span class="small">${childAgeLine(c)}</span></div>
        <${SecTitle}>Сегодня<//>
        ${quickTypes(ageMonthsOf(c)).length > 0 && html`<${TodayTiles} child=${c} types=${quickTypes(ageMonthsOf(c))} />`}
        <div class="rows">
          <${Row} title="Дневник по дням" sub="Что было и что в планах" onClick=${() => { track('карточка:дневник'); go('/rebyonok/dnevnik'); }} />
          <${Row} title="Рост" sub="Вес, рост, окружность головы — график" onClick=${() => { track('карточка:рост'); go('/rebyonok/rost'); }} />
          <${Row} title="Аллергии и паспорт здоровья" sub=${((((s.rebyonok || {}).med || {})[c.id] || {}).allergy || []).map((x) => x.text).join(', ') || 'Группа крови, аллергии, особенности'} onClick=${() => { track('карточка:аллергии'); go('/rebyonok/zdorovye/zapisi'); }} />
          <${Row} title="Документы ребёнка" sub="СНИЛС, полис, прививочный сертификат, справки" onClick=${() => { track('карточка:документы'); go('/rebyonok/vse-dokumenty'); }} />
          <${Row} title="Вести дневник вместе" sub=${familyLine(s)} onClick=${() => { track('карточка:семья'); go('/profil/semya'); }} />
        </div>
        <${SecTitle}>Данные<//>`}
      ${(isNew || c.expecting) && html`<div class="pills"><${Pill} on=${!expecting} onClick=${() => setExpecting(false)}>${c && c.expecting ? 'Малыш родился' : 'Уже родился'}<//><${Pill} on=${expecting} onClick=${() => setExpecting(true)}>Ждём<//></div>`}
      <${Field} label=${expecting ? 'Как назвать' : 'Имя'} value=${name} onInput=${setName} placeholder=${expecting ? 'Можно домашнее или «Малыш»' : 'Можно домашнее'} />
      <${Field} label=${expecting ? 'Предполагаемая дата родов' : 'Дата рождения'} value=${date} inputmode="numeric" placeholder="ДД.ММ.ГГГГ" onInput=${(v) => setDate(maskDate(v))}
        hint=${d ? (expecting ? expectingLine(d, now()) : d <= now() ? `Сейчас ${ageText(d, now())}` : '') : ''} />
      ${!expecting && html`
        <div class="sec-title">Пол · по желанию</div>
        <div class="pills">${[['girl', 'Девочка'], ['boy', 'Мальчик'], ['none', 'Не указывать']].map(([k, l]) => html`<${Pill} on=${sex === k} onClick=${() => setSex(k)}>${l}<//>`)}</div>
        <div class="sec-title">Срок рождения · по желанию</div>
        <${GestStepper} value=${gest} onChange=${setGest} />
        ${others.length > 0 && html`
          <div class="sec-title">Близнецы</div>
          <div class="pills">${others.map((o) => html`<${Pill} on=${twin === o.id} onClick=${() => setTwin(twin === o.id ? null : o.id)}>Двойня с ${o.name}<//>`)}</div>`}`}
      <label class="btn btn-gray">${photo ? 'Фото выбрано' : 'Фото'}<input type="file" accept="image/*" style="display:none" onChange=${(e) => setPhoto(e.target.files[0])} /></label>
      <button class="btn btn-primary" disabled=${!ok} onClick=${save}>Сохранить</button>
      ${!isNew && html`<button class="btn-quiet" onClick=${() => confirmAction({ title: 'Убрать карточку?', text: 'Записи этого ребёнка тоже удалятся с телефона.', yes: 'Убрать', onYes: () => { update((st) => { st.children = st.children.filter((x) => x.id !== c.id); st.records = st.records.filter((r) => r.childId !== c.id); st.activeChildId = st.children[0] ? st.children[0].id : null; }); go('/profil', { replace: true }); } })}>Убрать карточку</button>`}
    </div>`;
}

function TopicsSettings() {
  const s = useStore();
  const toggle = (k) => update((d) => { d.topics = d.topics.includes(k) ? d.topics.filter((x) => x !== k) : [...d.topics, k]; });
  return html`
    <div class="screen">
      <${Back} title="Что сейчас волнует" />
      <p class="lead">С этих тем начинаются статьи на «Сегодня».</p>
      <div class="pills">${TOPICS.map(([k, l]) => html`<${Pill} on=${s.topics.includes(k)} onClick=${() => toggle(k)}>${l}<//>`)}</div>
    </div>`;
}

function Buttons() {
  const s = useStore();
  const hidden = s.settings.hiddenButtons || [];
  const toggle = (k) => update((d) => { const h = d.settings.hiddenButtons || []; d.settings.hiddenButtons = h.includes(k) ? h.filter((x) => x !== k) : [...h, k]; });
  const child = (s.children.find((c) => c.id === s.activeChildId) || s.children[0]);
  const m = child && !child.expecting ? ageMonths(child, now()) : 0;
  const pr = child ? prefsOf(s, child) : {};
  const items = [['sleep', 'Сон'], ['feed', 'Кормление'], ['diaper', 'Подгузник'], ['food', 'Еда'], ['potty', 'Горшок']].filter(([k]) => quickTypes(m, pr).includes(k));
  const setPref = (k, v) => update((d) => { d.childPrefs = d.childPrefs || {}; d.childPrefs[child.id] = { ...(d.childPrefs[child.id] || {}), [k]: v }; });
  // Что у ребёнка уже позади или началось раньше — у каждого своё
  const life = child && !child.expecting && m < 48 ? [
    ['noBreast', 'Кормим грудью', true], ['noBottle', 'Даём бутылочку', true], ['noDiapers', 'Носим подгузники', true], ['potty', 'Ходим на горшок', false],
  ] : [];
  return html`
    <div class="screen">
      <${Back} title="Быстрая запись" />
      ${life.length > 0 && html`
        <${SecTitle}>${child.name ? 'У ' + genitive(child.name) + ' сейчас' : 'Сейчас'}<//>
        <div class="pills">${life.map(([k, l, inverse]) => { const on = inverse ? !pr[k] : !!pr[k]; return html`<${Pill} on=${on} onClick=${() => { setPref(k, inverse ? on : !on); track('профиль:' + k); }}>${l}<//>`; })}</div>
        <p class="small">Отметьте, что уже позади: бросили грудь — вкладка «Грудь» уберётся из «Кормления»; без подгузников — вместо них появится горшок. Прошлые записи останутся.</p>
        <${SecTitle}>Быстрые записи<//>`}
      ${items.length ? html`<p class="lead">Что показывать в «Записать» и на «Ребёнке». Что не записываете — уберите, прошлые записи останутся.</p>
      <div class="pills">${items.map(([k, l]) => html`<${Pill} on=${!hidden.includes(k)} onClick=${() => toggle(k)}>${l}<//>`)}</div>`
      : html`<p class="lead">С трёх лет быстрых записей нет: сон и еду дошкольника почти никто не записывает. Всё нужное — в «＋ Записать»: кружки, дела, температура, к врачу, моменты.</p>`}
    </div>`;
}

// Город для погоды и «Что надеть»: любой — поиском, или по месту, где вы сейчас
function City() {
  const s = useStore();
  const cities = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Краснодар', 'Самара', 'Ростов-на-Дону', 'Уфа'];
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = (name, ll) => { update((d) => { d.settings.city = name; d.settings.cityLL = ll || null; d.weather = null; }); track('город:выбран'); toast({ text: `Погода — для города ${name}`, ms: 2000 }); back('/segodnya'); };
  const find = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try { const { searchCities } = await import('./tabs/segodnya/weather.js?v=23'); setFound(await searchCities(q.trim())); } catch (e) { setFound([]); toast({ text: 'Не нашли — нужна сеть. Попробуйте ещё раз', ms: 2500 }); }
    setBusy(false);
  };
  const here = () => {
    if (!navigator.geolocation) { toast({ text: 'Этот браузер не знает, где вы. Найдите город поиском', ms: 3000 }); return; }
    navigator.geolocation.getCurrentPosition((p) => pick('Рядом с вами', [+p.coords.latitude.toFixed(2), +p.coords.longitude.toFixed(2)]), () => toast({ text: 'Место не определилось — найдите город поиском', ms: 3000 }), { timeout: 10000, maximumAge: 3600e3 });
  };
  return html`
    <div class="screen">
      <${Back} title="Город для погоды" />
      <p class="lead">Сейчас: ${s.settings.city || 'Москва'}. По нему — погода и «Что надеть» на «Сегодня».</p>
      <label class="field"><span class="label">Найти город</span>
        <input value=${q} placeholder="Например, Тверь" onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') find(); }} /></label>
      <button class="btn btn-primary" disabled=${q.trim().length < 2 || busy} onClick=${find}>${busy ? 'Ищем…' : 'Найти'}</button>
      ${found && (found.length ? html`<div class="rows">${found.map((c) => html`<${Row} title=${c.name} sub=${c.region} onClick=${() => pick(c.name, c.ll)} />`)}</div>` : html`<p class="small">Такого города не нашли — проверьте название.</p>`)}
      <button class="btn btn-gray" onClick=${here}>Определить, где я</button>
      <${SecTitle}>Крупные города<//>
      <div class="pills">${cities.map((c) => html`<${Pill} on=${s.settings.city === c && !s.settings.cityLL} onClick=${() => pick(c, null)}>${c}<//>`)}</div>
    </div>`;
}

// Копия записей — файл, который открывается на другом телефоне
// Таблица всех записей и заметок — открывается в Excel, Numbers, Google Таблицах (как выгрузка CSV в приложении)
function csvOf(st) {
  // Как csvCell в приложении: текст записи никогда не становится формулой в Excel
  const q = (x) => { let t = x == null ? '' : String(x); if (typeof x === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/u.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const two = (n) => String(n).padStart(2, '0');
  const d = (t) => { const x = new Date(t); return `${two(x.getDate())}.${two(x.getMonth() + 1)}.${x.getFullYear()}`; };
  const tm = (t) => { const x = new Date(t); return `${two(x.getHours())}:${two(x.getMinutes())}`; };
  const kid = (id) => (st.children.find((c) => c.id === id) || {}).name || '';
  const rows = [['Ребёнок', 'Дата', 'Время', 'Что', 'Подробности', 'Минут']];
  for (const r of st.records.slice().sort((a, b) => a.start - b.start)) {
    const what = describe(r);
    const [head, ...rest] = what.split(' · ');
    rows.push([kid(r.childId), d(r.start), tm(r.start), head, rest.join(', '), r.end && r.end > r.start ? Math.round((r.end - r.start) / 60000) : '']);
  }
  for (const n of (st.notes || [])) rows.push(['', d(n.at), tm(n.at), 'Заметка', (n.text || '').replace(/\n/g, ' '), '']);
  return '\ufeff' + rows.map((r) => r.map(q).join(';')).join('\r\n');
}
const saveFile = (text, name, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

function Backup() {
  const s = useStore();
  const pack = () => JSON.stringify({ app: 'nen-veb', v: 1, at: Date.now(), state: { ...getState(), demo: {} } });
  const done = (what) => { update((d) => { d.settings.lastBackupAt = Date.now(); }); track('копия:' + what); };
  const day = new Date().toISOString().slice(0, 10);
  const copy = async () => {
    try { await navigator.clipboard.writeText(pack()); done('скопирована'); toast({ text: 'Скопировали. Вставьте текст в заметки или отправьте себе в мессенджер', ms: 4000 }); }
    catch (e) { toast({ text: 'Не получилось скопировать. Попробуйте «Сохранить файлом»', ms: 3000 }); }
  };
  const last = s.settings.lastBackupAt;
  return html`
    <div class="screen">
      <${Back} title="Копия записей" />
      <p class="lead">Записи хранятся на этом телефоне и не зависят от сервера: если сайт или облако недоступны, дневник работает. Копия нужна на случай нового, сломанного или потерянного телефона.</p>
      <p class="small">${last ? `Последняя копия — ${new Date(last).toLocaleDateString('ru')}.` : 'Копию ещё не делали.'} Фото в копию не попадают.</p>
      <button class="btn btn-primary" onClick=${() => { saveFile(pack(), `nen-kopiya-${day}.json`, 'application/json'); done('файл'); }}>Сохранить файлом</button>
      <button class="btn btn-gray" onClick=${copy}>Скопировать текстом</button>
      <button class="btn btn-gray" onClick=${() => go('/profil/perenos')}>Перенести с другого телефона</button>
      <${SecTitle}>Таблицей<//>
      <p class="small">Все записи и заметки — одной таблицей: открывается в Excel, Numbers или Google Таблицах. Удобно показать врачу или сохранить у себя. Обратно в приложение таблица не переносится — для этого копия файлом.</p>
      <button class="btn btn-gray" onClick=${() => { saveFile(csvOf(getState()), `nen-zapisi-${day}.csv`, 'text/csv;charset=utf-8'); track('копия:таблица'); }}>Выгрузить таблицей</button>
    </div>`;
}

// Для исследования: отчёт недели, режим показа, сброс
function Research() {
  const s = useStore();
  const rep = statsReport();
  const copy = async () => {
    try { await navigator.clipboard.writeText(rep); toast({ text: 'Отчёт скопирован — отправьте его исследователю', ms: 3000 }); }
    catch (e) { toast({ text: 'Не получилось скопировать — выделите текст и скопируйте вручную', ms: 3000 }); }
  };
  const demo = (k, v) => update((d) => { d.demo = { ...d.demo, [k]: d.demo[k] === v ? null : v }; });
  return html`
    <div class="screen">
      <${Back} title="Для исследования" />
      <p class="lead">Здесь только обезличенный счёт: в какие дни открывали приложение и что нажимали. Имён, дат, текстов записей и заметок в отчёте нет.</p>
      <div class="note-box" style="white-space:pre-wrap;font-size:12px;max-height:240px;overflow:auto">${rep}</div>
      <button class="btn btn-primary" onClick=${copy}>Скопировать отчёт</button>
      <${SecTitle}>Режим показа — для встреч<//>
      <p class="small">Меняет только время суток на экране, записи остаются настоящими.</p>
      <div class="pills">
        ${[['day', 'День'], ['evening', 'Вечер'], ['night', 'Ночь']].map(([k, l]) => html`<${Pill} on=${s.demo.timeOfDay === k} onClick=${() => demo('timeOfDay', k)}>${l}<//>`)}
      </div>
      <div class="pills">
        <${Pill} on=${s.demo.course} onClick=${() => update((d) => { d.demo = { ...d.demo, course: !d.demo.course }; })}>С курсом<//>
        <${Pill} on=${s.demo.club} onClick=${() => update((d) => { d.demo = { ...d.demo, club: !d.demo.club }; })}>В Клубе<//>
        <${Pill} on=${s.demo.offline} onClick=${() => update((d) => { d.demo = { ...d.demo, offline: !d.demo.offline }; })}>Без сети<//>
      </div>
      <p class="small">Редкие состояния — посмотреть, как выглядят:</p>
      <div class="pills">
        <button class="pill" onClick=${() => go('/moy-nen?sostoyanie=pusto')}>«Мой НЭН»: пусто</button>
        <button class="pill" onClick=${() => go('/moy-nen?sostoyanie=pervyy-zapusk')}>Первый запуск без сети</button>
      </div>
      <${SecTitle}>Первый вход<//>
      <p class="small">Пройти его ещё раз, как в первый день. Записи, дети и заметки не тронутся.</p>
      <button class="btn btn-gray" onClick=${startPreview}>Посмотреть первый вход</button>
      <${SecTitle}>Начать заново<//>
      <button class="btn btn-gray" onClick=${() => confirmAction({ title: 'Стереть всё?', text: 'Записи, дети и заметки на этом телефоне удалятся, приложение начнётся с первого экрана.', yes: 'Стереть всё', onYes: () => { resetAll(); resetStats(); go('/start', { replace: true }); } })}>Стереть всё и начать с первого экрана</button>
    </div>`;
}

// Для проверки на людях: что за телефон и браузер, работает ли хранение. Без имён и записей.
function Diagnostics() {
  const ua = navigator.userAgent;
  const ios = (/OS (\d+)_(\d+)/.exec(ua) || []).slice(1).join('.');
  const where = /Telegram/i.test(ua) ? 'браузер Telegram' : /CriOS/.test(ua) ? 'Chrome на айфоне' : /FxiOS/.test(ua) ? 'Firefox на айфоне' : /Safari/.test(ua) && /iPhone|iPad/.test(ua) ? 'Safari' : /Android/.test(ua) ? 'Android' : 'компьютер';
  const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const ver = ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '—';
  const lines = [
    `Версия: ${ver}`,
    `Телефон: ${/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'другое'}${ios ? ', iOS ' + ios : ''}`,
    `Открыто: ${standalone ? 'с экрана телефона (как приложение)' : where}`,
    `Хранение записей: ${storage.ok ? 'работает' : 'не работает (' + storage.error + ')'}`,
    `Запасное сохранение: ${typeof structuredClone === 'function' ? 'не нужно' : 'включено'}`,
    `Детей: ${getState().children.length}, записей: ${getState().records.length}`,
  ];
  const text = lines.join('\n') + '\n' + ua;
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast({ text: 'Скопировали — отправьте Анастасии', ms: 2500 }); } catch (e) { toast({ text: 'Не скопировалось — сделайте снимок экрана', ms: 3000 }); } };
  return html`
    <div class="screen">
      <${Back} title="Если что-то не работает" />
      <p class="lead">Сделайте снимок этого экрана или скопируйте текст и пришлите нам — так мы быстрее поймём, что сломалось. Имён и записей здесь нет.</p>
      <div class="note-box" style="white-space:pre-wrap;font-size:13px">${lines.join('\n')}</div>
      <button class="btn btn-primary" onClick=${copy}>Скопировать</button>
    </div>`;
}

// Напоминания — как «Настройки → Напоминания» в приложении. В веб-версии уведомлений нет:
// напоминание встаёт на «Сегодня». В приложении — уведомлением, тихие часы 22–7 переносят на утро.
const REMINDERS = [
  ['visits', 'Визиты к врачу', 'Накануне — с адресом и временем'],
  ['vaccines', 'Прививки по календарю', 'Когда подходит срок и за день до записи'],
  ['meds', 'Лекарства по расписанию', 'Во время приёма'],
  ['medkit', 'Аптечка', 'Когда кончается срок годности'],
  ['notes', 'Заметки', 'В день, который выбрали'],
  ['backup', 'Копия записей', 'Раз в неделю, в 19:00'],
  ['quiet', 'Тихие часы', 'С 22 до 7 — перенесём на утро'],
];
function Reminders() {
  const s = useStore();
  const r = (s.settings && s.settings.reminders) || {};
  const set = (k) => update((d) => { d.settings.reminders = { ...(d.settings.reminders || {}), [k]: r[k] === false }; track('напоминания:' + k); });
  return html`
    <div class="screen">
      <${Back} title="Напоминания" />
      <p class="lead">О чём напомнить. Выключенное не придёт, записи останутся.</p>
      <div class="rows">${REMINDERS.map(([k, t, sub]) => html`<${Row} key=${k} title=${t} sub=${sub} end=${r[k] === false ? 'выключено' : 'включено'} onClick=${() => set(k)} />`)}</div>
      <p class="small">В пробной веб-версии напоминания приходят на «Сегодня», в «Важно сейчас». В приложении — уведомлением на телефоне; подробности на заблокированном экране не показываем.</p>
    </div>`;
}

// «НЭН Плюс» — что даёт подписка (как app/src/access/features.ts). Семья — бесплатно (журнал, 5 ноября)
function Plus() {
  const items = [
    ['✦ Помощник «Спросить»', 'Ответы по вашим записям и материалам НЭН'],
    ['Программа недели', 'Под ребёнка: по возрасту и дневнику'],
    ['Выписка для врача в PDF', 'И ссылка врачу на неё'],
    ['Все сказки и колыбельные', '«Минутка для себя» целиком и сказка голосом мамы'],
    ['Психологи Балансити', 'Со скидкой на консультации'],
  ];
  return html`
    <div class="screen">
      <${Back} title="НЭН Плюс" />
      <p class="lead">Плюс открывает помощника и всё, что редакция делает сверх бесплатного.</p>
      <div class="rows">${items.map(([t, sub]) => html`<${Row} key=${t} title=${t} sub=${sub} />`)}</div>
      <p class="p">Дневник, развитие, рост, здоровье, напоминания и «Вести дневник вместе» бесплатны всегда.</p>
      <p class="small">Платный Клуб НЭН включает Плюс. В пробной версии Плюс не продаётся.</p>
    </div>`;
}

export const profileRoutes = [
  { path: '/profil/napominaniya', view: Reminders },
  { path: '/profil/plus', view: Plus },
  { path: '/profil/pomosh', view: Diagnostics },
  { path: '/profil', view: Profile },
  { path: '/profil/rebyonok/:id', view: ChildCard },
  { path: '/profil/temy', view: TopicsSettings },
  { path: '/profil/knopki', view: Buttons },
  { path: '/profil/gorod', view: City },
  { path: '/profil/kopiya', view: Backup },
  { path: '/profil/perenos', view: Transfer },
  { path: '/profil/issledovanie', view: Research },
];
