// «Ребёнок → Моменты» (экраны 11, 14): воспоминание, месяцы лентами, книга «Первый год», лист «Новый момент».
import { html, useState } from '../../lib.js';
import { useStore, getState, update, now, uid, savePhoto, usePhoto } from '../../store.js';
import { Header, SecTitle, Row, Ill, Pill, Field, openSheet, closeSheet, toast } from '../../ui.js';
import { DAY, dateLong, diffYMD, startOfDay } from '../../age.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import { bornChild, nameOf, momentsOf, momentTitle, momentMore, memory, inFirstYear, cap } from './util.js';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const ORD = ['первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый', 'десятый', 'одиннадцатый', 'двенадцатый'];
const monthKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
function monthLabel(child, key) {
  const [y, m] = key.split('-').map(Number);
  const mid = new Date(y, m - 1, 15).getTime();
  const life = diffYMD(child.dob, mid).months;
  return life >= 0 && life < 12 ? `${MONTHS[m - 1]} · ${ORD[life]} месяц` : `${MONTHS[m - 1]} ${y}`;
}

// ——— Лист «Новый момент»: фото или слова, название уже подставлено ———
export function NewMomentSheet({ childId, text: preset = '', month = false }) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const twin = child && child.twinOf && s.children.find((c) => c.id === child.twinOf);
  const [title, setTitle] = useState(preset);
  const [more, setMore] = useState('');
  const [file, setFile] = useState(null);
  const [both, setBoth] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    let photo = null;
    try { photo = file ? await savePhoto(file) : null; } catch (e) { photo = null; }
    const ids = [child.id, ...(both && twin ? [twin.id] : [])];
    const made = ids.map(() => uid());
    const text = [title.trim(), more.trim()].filter(Boolean).join('\n');
    update((st) => { ids.forEach((cid, i) => st.moments.unshift({ id: made[i], childId: cid, text, photo, at: now(), ...(month ? { month: true } : {}) })); });
    track('моменты:сохранить' + (photo ? '-фото' : '-слова'));
    closeSheet();
    toast({ text: 'Момент сохранили — первым в «Моментах»', actions: [{ label: 'Отменить', onClick: () => update((st) => { st.moments = st.moments.filter((m) => !made.includes(m.id)); }) }] });
  };
  return html`
    <div class="h2">${month ? 'Фото месяца' : 'Новый момент'}</div>
    <div class="small">${nameOf(child)} · ${dateLong(now())}</div>
    <div class="pills">
      <label class=${'pill' + (file ? ' on' : '')}>${file ? '✓ Фото' : 'Фото'}<input type="file" accept="image/*" style="display:none" onChange=${(e) => { setFile(e.target.files[0] || null); track('моменты:фото'); }} /></label>
      <${Pill} on=${!file} onClick=${() => setFile(null)}>Слова<//>
    </div>
    <${Field} label="Что случилось" value=${title} onInput=${setTitle} placeholder="Первый раз засмеялся в голос" />
    <label class="field"><span class="label">Подробнее — если хочется</span><textarea value=${more} placeholder="Где были, кто рядом, что сказал" onInput=${(e) => setMore(e.target.value)}></textarea></label>
    ${twin && html`<div class="pills"><${Pill} on=${!both} onClick=${() => setBoth(false)}>${nameOf(child)}<//><${Pill} on=${both} onClick=${() => setBoth(true)}>Обоим<//></div>
      <div class="tiny">«Обоим» — момент попадёт в альбом каждого.</div>`}
    <button class="btn btn-primary" disabled=${busy || (!title.trim() && !file)} onClick=${save}>Сохранить</button>
    <div class="tiny">Фото хранится только на этом телефоне.</div>`;
}
export const openNewMoment = (child, opts = {}) => { track('моменты:новый'); openSheet(NewMomentSheet, { childId: child.id, ...opts }); };

// ——— Момент целиком ———
function share(m) {
  const text = momentTitle(m) + (momentMore(m) ? '\n' + momentMore(m) : '') + `\n${dateLong(m.at)}`;
  track('моменты:поделиться');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast({ text: 'Скопировали — можно вставить в сообщение', ms: 2500 }), () => {});
}
function MomentSheet({ id }) {
  const s = useStore();
  const m = s.moments.find((x) => x.id === id);
  const url = usePhoto(m && m.photo);
  if (!m) return html`<div class="h2">Момента больше нет</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const remove = () => {
    const copy = { ...m };
    update((st) => { st.moments = st.moments.filter((x) => x.id !== id); });
    closeSheet();
    track('моменты:удалить');
    toast({ text: 'Момент убрали', actions: [{ label: 'Вернуть', onClick: () => update((st) => { st.moments.unshift(copy); st.moments.sort((a, b) => b.at - a.at); }) }] });
  };
  return html`
    ${url ? html`<img class="rb-bigphoto" src=${url} alt="" />` : m.photo ? html`<${Ill} text="Фото из момента" big />` : ''}
    <div class="tiny">${dateLong(m.at)}${m.month ? ' · фото месяца' : ''}</div>
    <div class="h2">${momentTitle(m)}</div>
    ${momentMore(m) && html`<p class="p">${momentMore(m)}</p>`}
    <div class="actions"><button onClick=${() => share(m)}>Поделиться</button><button onClick=${remove}>Удалить</button></div>`;
}
export const openMoment = (m) => { track('моменты:открыть'); openSheet(MomentSheet, { id: m.id }); };

// Карточка момента в ленте
export function MomentCard({ m, label }) {
  const url = usePhoto(m.photo);
  return html`
    <button class="feed-card rb-card" onClick=${() => openMoment(m)}>
      ${url ? html`<span class="rb-photo"><img src=${url} alt="" /></span>` : html`<span class="ill">${m.photo ? 'Фото' : 'Слова'}</span>`}
      <span class="tiny">${label || dateLong(m.at)}</span>
      <span class="t">${momentTitle(m)}</span>
    </button>`;
}

// Воспоминание большой карточкой, как карточка дня
export function MemoryCard({ child, mem }) {
  const m = mem.moment;
  const url = usePhoto(m.photo);
  const hide = () => {
    track('моменты:не-показывать');
    update((st) => { st.dismissed = [...(st.dismissed || []), 'memory:' + m.id]; });
    toast({ text: 'Больше не напомним', actions: [{ label: 'Вернуть', onClick: () => update((st) => { st.dismissed = (st.dismissed || []).filter((x) => x !== 'memory:' + m.id); }) }] });
  };
  return html`
    <div class="card rb-memory">
      ${url ? html`<img class="rb-bigphoto" src=${url} alt="" onClick=${() => openMoment(m)} />` : html`<${Ill} text=${m.photo ? 'Фото из момента' : 'Слова'} />`}
      <div class="tiny">${mem.label} · ${dateLong(m.at)}</div>
      <button class="h2" style="text-align:left" onClick=${() => openMoment(m)}>${momentTitle(m)}</button>
      ${momentMore(m) && html`<p class="p">«${momentMore(m)}»</p>`}
      <div class="tiny">Записано ${dateLong(m.at)}</div>
      <div class="actions"><button onClick=${() => share(m)}>Поделиться</button><button onClick=${hide}>Не показывать</button></div>
    </div>`;
}

function Moments({ query }) {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<div class="screen"><${Header} /><h1 class="h1">Моменты</h1><p class="lead">Моменты появятся, когда малыш родится.</p></div>`;
  const list = momentsOf(child, s);
  const mem = memory(child, s);
  // Один месяц целиком
  if (query && query.mesyac) {
    const items = list.filter((m) => monthKey(m.at) === query.mesyac);
    return html`
      <div class="screen">
        <${Header} />
        <h1 class="h1">${cap(monthLabel(child, query.mesyac))}</h1>
        <button class="link" style="text-align:left" onClick=${() => openNewMoment(child)}>＋ Момент</button>
        ${!items.length && html`<p class="empty">В этом месяце моментов нет.</p>`}
        <div class="rb-grid">${items.map((m) => html`<${MomentCard} key=${m.id} m=${m} />`)}</div>
        <button class="btn btn-gray" onClick=${() => go('/rebyonok/momenty')}>Все месяцы</button>
      </div>`;
  }
  const months = [];
  for (const m of list) { const k = monthKey(m.at); let g = months.find((x) => x.k === k); if (!g) months.push(g = { k, items: [] }); g.items.push(m); }
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Моменты</h1>
      ${mem && html`<${MemoryCard} child=${child} mem=${mem} />`}
      <button class="rb-add" onClick=${() => openNewMoment(child)}>＋ Момент</button>
      ${!list.length && html`<p class="lead">Альбом начнётся с вашей истории. Добавьте первый момент — без подготовки и особого повода.</p>`}
      ${months.map((g) => html`
        <${SecTitle} more="Все" onMore=${() => { track('моменты:месяц'); go('/rebyonok/momenty?mesyac=' + g.k); }}>${monthLabel(child, g.k)}<//>
        <div class="feed">${g.items.slice(0, 8).map((m) => html`<${MomentCard} key=${m.id} m=${m} />`)}</div>`)}
      <${SecTitle}>Книга<//>
      <div class="rows"><${Row} title="«Первый год»" sub="Книга из ваших моментов — соберётся к году" onClick=${() => { track('моменты:книга'); go('/rebyonok/momenty/kniga'); }} /></div>
      ${!s.account && html`<p class="tiny">Моменты хранятся только на этом телефоне. Сохранить копию — в профиле, «Копия записей».</p>`}
    </div>`;
}

// Книга «Первый год»: двенадцать месяцев, по фото месяца или первому моменту
function Book() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<div class="screen"><${Header} /><h1 class="h1">«Первый год»</h1><p class="lead">Книга начнётся, когда малыш родится.</p></div>`;
  const list = momentsOf(child, s);
  const year = list.filter((m) => m.at - child.dob < 366 * DAY);
  const months = Array.from({ length: 12 }, (_, i) => {
    const inMonth = year.filter((m) => diffYMD(child.dob, m.at).months === i);
    return { i, m: inMonth.find((x) => x.month) || inMonth[inMonth.length - 1] || null, n: inMonth.length };
  });
  const filled = months.filter((x) => x.m).length;
  const ready = !inFirstYear(child);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">«Первый год»</h1>
      <p class="lead">${ready ? `Год позади: в книге ${filled} из 12 месяцев.` : `Книга соберётся к году из ваших моментов. Уже есть ${filled} из 12 месяцев.`}</p>
      <div class="rows">
        ${months.map((x) => html`<${Row} title=${`${cap(ORD[x.i])} месяц`} sub=${x.m ? `${momentTitle(x.m)} · ${dateLong(x.m.at)}${x.n > 1 ? ` · ещё ${x.n - 1}` : ''}` : 'Пока пусто'} chev=${!!x.m} onClick=${() => x.m && openMoment(x.m)} />`)}
      </div>
      <button class="btn btn-primary" onClick=${() => openNewMoment(child)}>＋ Момент</button>
      <p class="tiny">Скачать книгу файлом можно будет в приложении НЭН.</p>
    </div>`;
}

export const momentyRoutes = [
  { path: '/rebyonok/momenty', view: Moments, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/momenty/kniga', view: Book, tab: '/rebyonok', strip: true },
];
