// «Ребёнок → Сказки и звуки» (экраны 7, 19): колыбельные, шум, потешки и стихи, сказки — лентами;
// шум — одним касанием, таймер — листом; избранное, без сети, «Ваш голос».
import { html, useState, useEffect } from '../../lib.js?v=20';
import { useStore, useTick, getState, now, uid } from '../../store.js?v=20';
import { Header, Back, SecTitle, Row, Ill, Pill, SaveButton, openSheet, closeSheet, toast } from '../../ui.js?v=20';
import { ageMonths, dateLong } from '../../age.js?v=20';
import { NOISE, playNoise, play, usePlayer, toggle, stop } from '../../player.js?v=20';
import { go } from '../../router.js?v=20';
import { track } from '../../stats.js?v=20';
import { TALES, SONGS } from '../../content/rebyonok-skazki.js?v=20';
import { R, rUpdate, bornChild, isOffline, FeedCard } from './util.js?v=20';

const NOISE_TEXT = { white: 'Ровное шипение, как у радио между станциями. Приглушает звуки квартиры: разговор за стеной, шаги, дверь.', pink: 'Тоже ровный, но ниже и мягче белого: больше похож на ветер или далёкий водопад, чем на шипение.' };
const NOISE_SHORT = { white: 'Как радио между станциями', pink: 'Мягче на высоких' };
const TIP = 'Звук начнётся тихо. Поставьте телефон подальше от кроватки, а не в неё, и не включайте на максимум. Таймер уже стоит — звук выключится сам.';
const favCount = (s) => (s.saved || []).filter((x) => x.kind === 'tale').length;
const isFav = (s, id) => (s.saved || []).some((x) => x.kind === 'tale' && x.id === id);
const minsLeft = (p) => (p && p.until ? Math.max(1, Math.round((p.until - Date.now()) / 60000)) : 0);

// Шум одним касанием: играет 30 минут, как в приложении
export function startNoise(id = 'white', minutes = 30) {
  playNoise(id, minutes);
  track('звуки:шум-' + id);
  if (!R().noiseTip) { rUpdate((r) => { r.noiseTip = Date.now(); }); toast({ text: TIP, ms: 7000 }); }
}

// ——— Лист плеера: таймер, избранное, пауза, стоп ———
function PlayerSheet() {
  const s = useStore();
  const p = usePlayer();
  useTick(15000);
  if (!p) return html`<div class="h2">Ничего не играет</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const noise = NOISE.find((n) => n.id === p.id);
  const left = minsLeft(p);
  const setTimer = (m) => {
    track('плеер:таймер-' + (m || 'без'));
    if (noise) playNoise(noise.id, m);
    else play({ id: p.id, title: p.title, sub: m ? `выключится через ${m} мин` : '', src: p.src, loop: p.loop, minutes: m });
  };
  const favId = noise ? 'noise:' + noise.id : p.id;
  return html`
    <div class="h2">${p.title}</div>
    <div class="small">${p.paused ? 'На паузе' : left ? `Играет · ещё ${left} мин` : 'Играет, пока не выключите'}</div>
    <div class="label">Таймер</div>
    <div class="pills">
      ${[10, 20, 30, 45, 60].map((m) => html`<${Pill} on=${left && Math.abs(left - m) < 1.5 && p.until} onClick=${() => setTimer(m)}>${m === 60 ? '1 час' : m + ' мин'}<//>`)}
      <${Pill} on=${!p.until} onClick=${() => setTimer(0)}>Без таймера<//>
    </div>
    <div class="actions">
      <${SaveButton} item=${{ kind: 'tale', id: favId, title: p.title, sub: noise ? 'Шум' : 'Сказки и звуки', route: '/rebyonok/skazki' }} label="В избранное" />
      <button onClick=${() => { toggle(); track('плеер:пауза'); }}>${p.paused ? 'Играть' : 'Пауза'}</button>
      <button onClick=${() => { stop(); closeSheet(); track('плеер:стоп'); }}>Стоп</button>
    </div>
    <button class="btn btn-primary" onClick=${closeSheet}>Готово</button>
    ${noise && html`<p class="tiny">${TIP}</p>`}`;
}
export const openPlayer = () => { track('плеер:лист'); openSheet(PlayerSheet, {}); };

// Сейчас играет — строкой на экране; касание — лист с таймером
export function NowPlaying() {
  const p = usePlayer();
  useTick(15000);
  if (!p) return null;
  const left = minsLeft(p);
  return html`<button class="rb-now" onClick=${openPlayer}><span><b>${p.title}</b>${p.paused ? ' · на паузе' : left ? ` · ещё ${left} мин` : ''}</span><span>Таймер ›</span></button>`;
}

function NoiseCard({ n }) {
  const p = usePlayer();
  useTick(15000);
  const on = p && p.id === n.id;
  const label = on ? (p.paused ? 'На паузе' : minsLeft(p) ? `Играет · ещё ${minsLeft(p)} мин` : 'Играет') : NOISE_SHORT[n.id];
  return html`<${FeedCard} ill="Шум" label=${label} title=${n.title} onClick=${() => (on ? openPlayer() : startNoise(n.id))} />`;
}

const songLabel = (s, x) => [isFav(s, x.id) ? 'В избранном' : null, x.dur].filter(Boolean).join(' · ');
const yrs = (x) => { const a = Math.floor(x.fromM / 12), b = Math.floor(x.toM / 12); return `${a}–${b} ${b >= 2 && b <= 4 ? 'года' : 'лет'}`; };
const fits = (x, m) => m >= x.fromM - 2 && m <= x.toM;
const byFit = (m) => (a, b) => (fits(b, m) ? 1 : 0) - (fits(a, m) ? 1 : 0);

function Tales() {
  const s = useStore();
  const child = bornChild(s);
  const m = child ? Math.max(0, ageMonths(child, now())) : 0;
  const offline = isOffline(s);
  const lull = SONGS.filter((x) => x.type === 'lullaby' && m <= x.toM + 12).sort(byFit(m));
  const rhymes = SONGS.filter((x) => x.type !== 'lullaby' && m <= x.toM + 12).sort(byFit(m));
  const tales = TALES.filter((x) => m <= x.toM + 12).sort((a, b) => byFit(m)(a, b) || a.fromM - b.fromM);
  const open = (id) => { track('звуки:открыть'); go('/rebyonok/skazka/' + id); };
  const lanes = {
    lull: html`<${SecTitle} more="Все" onMore=${() => go('/rebyonok/skazki/vse?vid=kolybelnye')}>Колыбельные<//>
      <div class="feed">${lull.slice(0, 8).map((x) => html`<${FeedCard} key=${x.id} label=${songLabel(s, x)} title=${x.title} onClick=${() => open(x.id)} />`)}</div>`,
    noise: html`<${SecTitle}>Шум<//><div class="feed">${NOISE.map((n) => html`<${NoiseCard} key=${n.id} n=${n} />`)}</div>`,
    rhymes: html`<${SecTitle} more="Все" onMore=${() => go('/rebyonok/skazki/vse?vid=poteshki')}>Потешки и стихи<//>
      <div class="feed">${rhymes.slice(0, 8).map((x) => html`<${FeedCard} key=${x.id} label=${songLabel(s, x)} title=${x.title} onClick=${() => open(x.id)} />`)}</div>`,
    tales: html`<${SecTitle} more="Все" onMore=${() => go('/rebyonok/skazki/vse?vid=skazki')}>Сказки<//>
      <div class="feed">${tales.slice(0, 8).map((x) => html`<${FeedCard} key=${x.id} label=${[isFav(s, x.id) ? 'В избранном' : null, x.min ? x.min + ' мин' : null].filter(Boolean).join(' · ')} title=${x.title} onClick=${() => open(x.id)} />`)}</div>`,
  };
  const order = m >= 24 ? ['tales', 'lull', 'noise', 'rhymes'] : ['lull', 'noise', 'rhymes', 'tales'];
  const fc = favCount(s);
  const voice = (R(s).voice || []).length;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Сказки и звуки</h1>
      ${offline && html`<p class="note-box">Нет сети — шум, колыбельные и потешки на телефоне, всё работает.</p>`}
      <${NowPlaying} />
      ${order.map((k) => lanes[k])}
      <${SecTitle}>Своё<//>
      <div class="rows">
        <${Row} title="Избранное" sub=${fc ? `${fc} ${fc === 1 ? 'запись' : fc < 5 ? 'записи' : 'записей'} — сердечком на карточке` : 'Сердечко на карточке — и она здесь'} onClick=${() => { track('звуки:избранное'); go('/rebyonok/skazki/izbrannoe'); }} />
        <${Row} title="Скачанное" sub=${offline ? 'Шум и тексты колыбельных — играют и читаются без сети' : 'Слушать ночью без сети'} onClick=${() => { track('звуки:скачанное'); go('/rebyonok/skazki/skachannoe'); }} />
        <${Row} title="Ваш голос" sub=${voice ? `${voice} ${voice === 1 ? 'запись' : voice < 5 ? 'записи' : 'записей'}` : 'Запишите колыбельную своим голосом'} onClick=${() => { track('звуки:голос'); go('/rebyonok/skazki/golos'); }} />
      </div>
      <p class="tiny">Сказки и колыбельные голосом чтецов НЭН — в приложении. Здесь — тексты колыбельных и потешек, чтобы петь самим, и шум.</p>
    </div>`;
}

// Все записи одного вида
function All({ query }) {
  const s = useStore();
  const vid = query.vid || 'kolybelnye';
  const title = { kolybelnye: 'Колыбельные', poteshki: 'Потешки и стихи', skazki: 'Сказки' }[vid] || 'Сказки и звуки';
  const list = vid === 'skazki' ? TALES : SONGS.filter((x) => (vid === 'kolybelnye' ? x.type === 'lullaby' : x.type !== 'lullaby'));
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${title}</h1>
      <div class="rows">${list.map((x) => html`<${Row} key=${x.id} title=${x.title} sub=${vid === 'skazki' ? `${x.author}${x.by ? ', ' + x.by : ''} · ${yrs(x)}` : `${x.kind} · ${x.dur}`} end=${isFav(s, x.id) ? '♥' : ''} onClick=${() => go('/rebyonok/skazka/' + x.id)} />`)}</div>
    </div>`;
}

// Колыбельная, потешка или сказка
function Item({ params }) {
  const s = useStore();
  const song = SONGS.find((x) => x.id === params.id);
  const tale = TALES.find((x) => x.id === params.id);
  if (!song && !tale) return html`<div class="screen"><${Back} title="Сказки и звуки" to="/rebyonok/skazki" /><p class="empty">Такой записи нет. Остальные — в «Сказках и звуках».</p><button class="btn btn-primary" onClick=${() => go('/rebyonok/skazki')}>Сказки и звуки</button></div>`;
  if (song) {
    return html`
      <div class="screen">
        <${Back} />
        <${Ill} keep seed=${song.id} />
        <div class="tiny">${song.kind} · ${song.dur}</div>
        <h1 class="h1">${song.title}</h1>
        <div class="rb-verse">${song.text}</div>
        ${song.note && html`<p class="small">${song.note}</p>`}
        <p class="note-box">Голосом чтеца — в приложении НЭН, запись готовит редакция. Текст на телефоне: его можно петь и без сети. Имя в песне меняют на имя ребёнка — так колыбельные и пели.</p>
        <div class="actions"><${SaveButton} item=${{ kind: 'tale', id: song.id, title: song.title, sub: song.kind, route: '/rebyonok/skazka/' + song.id }} label="В избранное" /></div>
        <button class="btn btn-gray" onClick=${() => { startNoise('white'); }}>Включить белый шум</button>
      </div>`;
  }
  return html`
    <div class="screen">
      <${Back} />
      <${Ill} big keep seed=${tale.id} />
      <div class="tiny">Сказка · ${yrs(tale)}${tale.min ? ` · ${tale.min} мин вслух` : ''}</div>
      <h1 class="h1">${tale.title}</h1>
      <p class="small">${tale.author}${tale.by ? ', ' + tale.by : ''}${tale.alt ? ` · ${tale.alt}` : ''}</p>
      <p class="p">${tale.about}</p>
      <p class="note-box">Слушать — в приложении НЭН: сказку читают чтецы редакции.${tale.plus ? ' Эта сказка — в Плюсе.' : ''}</p>
      <div class="actions"><${SaveButton} item=${{ kind: 'tale', id: tale.id, title: tale.title, sub: 'Сказка', route: '/rebyonok/skazka/' + tale.id }} label="В избранное" /></div>
      <button class="btn btn-gray" onClick=${() => go('/rebyonok/skazki/vse?vid=kolybelnye')}>Колыбельные — текстом</button>
    </div>`;
}

function Favorites() {
  const s = useStore();
  const list = (s.saved || []).filter((x) => x.kind === 'tale');
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Избранное</h1>
      ${!list.length && html`<p class="lead">Здесь соберётся то, что отметите сердечком: колыбельные, сказки, шум. Оно же — в «Сохранённом» в шапке.</p>`}
      <div class="rows">${list.map((x) => {
        const nid = x.id.startsWith('noise:') ? x.id.slice(6) : null;
        return html`<${Row} key=${x.id} title=${x.title} sub=${x.sub} end=${nid ? 'Играть' : ''} onClick=${() => (nid ? startNoise(nid) : go(x.route))} />`;
      })}</div>
      <button class="btn btn-gray" onClick=${() => go('/rebyonok/skazki')}>Сказки и звуки</button>
    </div>`;
}

function Downloaded() {
  const s = useStore();
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Скачанное</h1>
      <p class="small">Это на телефоне и работает без сети: шум и тексты колыбельных и потешек. Записи чтецов скачиваются в приложении НЭН.</p>
      <${SecTitle}>Шум<//>
      <div class="rows">${NOISE.map((n) => html`<${Row} key=${n.id} title=${n.title} sub=${NOISE_TEXT[n.id]} end="Играть" onClick=${() => startNoise(n.id)} />`)}</div>
      <${SecTitle}>Колыбельные и потешки — текстом<//>
      <div class="rows">${SONGS.map((x) => html`<${Row} key=${x.id} title=${x.title} sub=${x.kind} onClick=${() => go('/rebyonok/skazka/' + x.id)} />`)}</div>
    </div>`;
}

// ——— «Ваш голос»: запись колыбельной своим голосом, хранится на телефоне ———
const VDB = 'nen-veb-voice';
function vdb() { return new Promise((res, rej) => { const r = indexedDB.open(VDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function putVoice(id, blob) { const db = await vdb(); await new Promise((res, rej) => { const tx = db.transaction('v', 'readwrite'); tx.objectStore('v').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function getVoice(id) { const db = await vdb(); return new Promise((res) => { const r = db.transaction('v').objectStore('v').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }
async function delVoice(id) { const db = await vdb(); await new Promise((res) => { const tx = db.transaction('v', 'readwrite'); tx.objectStore('v').delete(id); tx.oncomplete = res; tx.onerror = res; }); }

let rec = null;
function Voice() {
  const s = useStore();
  const [state, setState] = useState(rec ? 'rec' : 'idle');
  const [err, setErr] = useState('');
  const [started, setStarted] = useState(0);
  useTick(state === 'rec' ? 1000 : 60000);
  useEffect(() => () => { if (rec && rec.state === 'recording') rec.stop(); }, []);
  const list = R(s).voice || [];
  const can = typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        rec = null;
        const id = uid();
        try { await putVoice(id, blob); } catch (e) { setErr('Не получилось сохранить запись на телефоне.'); setState('idle'); return; }
        const n = (R().voice || []).length + 1;
        rUpdate((r) => { r.voice = [{ id, title: `Колыбельная вашим голосом${n > 1 ? ' ' + n : ''}`, at: now() }, ...(r.voice || [])]; });
        track('голос:записать');
        setState('idle');
        toast({ text: 'Записали — играет из «Вашего голоса»', ms: 3000 });
      };
      rec.start();
      setStarted(Date.now());
      setState('rec');
    } catch (e) { setErr('Нет доступа к микрофону. Разрешите его в настройках браузера и попробуйте ещё раз.'); }
  };
  const listen = async (v) => {
    const blob = await getVoice(v.id);
    if (!blob) { toast({ text: 'Запись не нашлась на этом телефоне', ms: 2500 }); return; }
    play({ id: 'voice:' + v.id, title: v.title, sub: 'ваш голос', src: URL.createObjectURL(blob), minutes: 0 });
    track('голос:слушать');
  };
  const remove = async (v) => { await delVoice(v.id); rUpdate((r) => { r.voice = (r.voice || []).filter((x) => x.id !== v.id); }); toast({ text: 'Запись удалили', ms: 2000 }); };
  const sec = Math.floor((Date.now() - started) / 1000);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Ваш голос</h1>
      <p class="lead">Запишите колыбельную или сказку своим голосом — она будет играть, когда вас нет рядом. Запись хранится только на этом телефоне.</p>
      ${!can ? html`<p class="note-box">Этот браузер не умеет записывать звук. Запись своим голосом есть в приложении НЭН.</p>`
        : state === 'rec' ? html`<button class="btn btn-primary" onClick=${() => rec && rec.stop()}>Закончить запись · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</button>`
        : html`<button class="btn btn-primary" onClick=${start}>Записать</button>`}
      ${err && html`<p class="small">${err}</p>`}
      <div class="rows">${list.map((v) => html`<div class="row"><button class="row-text" onClick=${() => listen(v)}><span class="row-title">${v.title}</span><span class="row-sub">${dateLong(v.at)} · касание — слушать</span></button><button class="row-end" onClick=${() => remove(v)}>Удалить</button></div>`)}</div>
      <button class="btn btn-gray" onClick=${() => go('/rebyonok/skazki/vse?vid=kolybelnye')}>Тексты колыбельных</button>
    </div>`;
}

export const skazkiRoutes = [
  { path: '/rebyonok/skazki', view: Tales, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/skazki/vse', view: All, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/skazki/izbrannoe', view: Favorites, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/skazki/skachannoe', view: Downloaded, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/skazki/golos', view: Voice, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/skazka/:id', view: Item, tab: '/rebyonok', strip: true },
];
export const talesFav = favCount;
