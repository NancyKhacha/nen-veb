// Плеер: шум, колыбельные, сказки и практики. Один на всё приложение, мини-плеер — над полосой записи.
import { html, useState, useEffect } from './lib.js?v=17';
import { track } from './stats.js?v=17';
import { go } from './router.js?v=17';

let audio = null;
let cur = null; // { id, title, sub, src, loop, until, route } — route: куда ведёт касание мини-плеера
let timer = null;
const ls = new Set();
const emit = () => ls.forEach((l) => l(cur ? { ...cur, paused: audio ? audio.paused : true } : null));

export function play({ id, title, sub = '', src, loop = false, minutes = 0, route = '' }) {
  stop(false);
  audio = new Audio(src);
  audio.loop = loop;
  audio.play().catch(() => {});
  audio.onended = () => { if (!loop) stop(); };
  cur = { id, title, sub, src, loop, route, until: minutes ? Date.now() + minutes * 60000 : 0 };
  if (minutes) timer = setTimeout(() => stop(), minutes * 60000);
  track('плеер:' + (id || title));
  emit();
}
export function toggle() { if (!audio) return; if (audio.paused) audio.play(); else audio.pause(); emit(); }
export function stop(notify = true) {
  clearTimeout(timer);
  if (audio) { audio.pause(); audio.src = ''; }
  audio = null; cur = null;
  if (notify) emit();
}
export const playing = () => cur;

export function usePlayer() {
  const [p, setP] = useState(cur ? { ...cur, paused: audio ? audio.paused : true } : null);
  useEffect(() => { ls.add(setP); return () => ls.delete(setP); }, []);
  return p;
}

// Шум для сна — белый и розовый из приложения
export const NOISE = [
  { id: 'white', title: 'Белый шум', src: 'sounds/white-noise.wav' },
  { id: 'pink', title: 'Розовый шум', src: 'sounds/pink-noise.wav' },
];
export const playNoise = (id = 'white', minutes = 0) => { const n = NOISE.find((x) => x.id === id) || NOISE[0]; play({ ...n, sub: minutes ? `выключится через ${minutes} мин` : 'играет, пока не выключите', loop: true, minutes, route: '/rebyonok/skazki' }); };

export function MiniPlayer() {
  const p = usePlayer();
  if (!p) return null;
  return html`
    <div class="between" style="margin:0 12px 8px;background:var(--gray);border-radius:14px;padding:10px 14px">
      <button style="min-width:0;flex:1" onClick=${() => p.route && go(p.route)}><div class="h3" style="font-size:14px">${p.title}</div><div class="tiny">${p.sub}</div></button>
      <span style="display:flex;gap:14px;font-weight:600;font-size:14px">
        <button onClick=${toggle}>${p.paused ? 'Играть' : 'Пауза'}</button>
        <button onClick=${() => stop()}>Выключить</button>
      </span>
    </div>`;
}
