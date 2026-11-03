// «Минутка для себя»: практика идёт по шагам текста. Аудио ещё не записано, поэтому в общем плеере
// играет тишина — так практика занимает тот же мини-плеер над полосой, что шум, и, как в приложении,
// останавливает шум ребёнка (плеер один). Пауза и «Выключить» мини-плеера останавливают и практику.
import { useState, useEffect } from '../../lib.js';
import { update, getState, toggleSaved, isSaved } from '../../store.js';
import { play, stop, toggle, playing, usePlayer } from '../../player.js';
import { toast } from '../../ui.js';
import { track } from '../../stats.js';
import { PRACTICES, practiceById } from '../../content/dlya-sebya-minutka.js';

export { PRACTICES, practiceById };
export const PLAYER_ID = 'minutka';

// Бесплатно всегда — четыре практики (каталог редакции); остальные — в Плюсе.
// В веб-версии Плюс не продаётся; платный Клуб включает Плюс — режим «В Клубе» его открывает.
export const hasPlus = (s = getState()) => !!(s.demo && s.demo.club);
export const locked = (p, s = getState()) => !p.free && !hasPlus(s);

const ds = (s = getState()) => s.dlyaSebya || {};
export const wasPlayed = (id, s = getState()) => !!(ds(s).played || {})[id];

const stepDur = (st) => (st.r || 0) + (st.p || 0);
export const totalSec = (p) => p.steps.reduce((a, st) => a + stepDur(st), 0);

// ——— Тишина для общего плеера (1 секунда, по кругу) ———
let silentUrl = null;
function silence() {
  if (silentUrl) return silentUrl;
  const rate = 8000, n = rate;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

// ——— Состояние практики (только в памяти, как у плеера) ———
let run = null; // { id, start, pausedAt, pausedMs, done }
const subs = new Set();
const emit = () => subs.forEach((f) => f());
let ticker = null;

export const current = () => run;
export function elapsedSec() {
  if (!run) return 0;
  const t = run.pausedAt || Date.now();
  return Math.max(0, (t - run.start - run.pausedMs) / 1000);
}
export function isRunning(id) { return !!(run && run.id === id && !run.done); }

export function startPractice(id) {
  const p = practiceById(id);
  if (!p) return;
  play({ id: PLAYER_ID, title: p.title, sub: `Минутка для себя · ${p.min} мин`, src: silence(), loop: true });
  run = { id, start: Date.now(), pausedAt: null, pausedMs: 0, done: false };
  update((s) => {
    s.dlyaSebya = s.dlyaSebya || {};
    s.dlyaSebya.played = { ...(s.dlyaSebya.played || {}), [id]: Date.now() };
  });
  track('для себя:минутка');
  if (!ticker) ticker = setInterval(tick, 1000);
  emit();
}

function tick() {
  if (!run || run.done) { clearInterval(ticker); ticker = null; return; }
  const cur = playing();
  if (!cur || cur.id !== PLAYER_ID) { run = null; emit(); return; } // выключили в мини-плеере или включили шум
  const p = practiceById(run.id);
  if (!run.pausedAt && elapsedSec() >= totalSec(p)) finish();
  emit();
}

function finish() {
  const p = practiceById(run.id);
  run.done = true;
  run.pausedAt = null;
  stop();
  track('для себя:минутка до конца');
  const item = savedItem(p);
  toast({
    text: 'Практика закончилась',
    actions: isSaved('practice', p.id) ? [] : [{ label: '♡ Сохранить', onClick: () => { toggleSaved(item); toast({ text: 'Сохранено — под сердечком в шапке', ms: 2500 }); } }],
    ms: 6000,
  });
  emit();
}

export function stopPractice() {
  if (run && !run.done) { const cur = playing(); if (cur && cur.id === PLAYER_ID) stop(); }
  run = null;
  track('для себя:минутка стоп');
  emit();
}

// Пауза — через общий плеер, чтобы мини-плеер и экран практики показывали одно и то же
export function pauseOrResume() { if (run && !run.done) { track('для себя:минутка пауза'); toggle(); } }

// Следующий шаг: текст читается быстрее голоса
export function skipStep() {
  if (!run || run.done) return;
  const p = practiceById(run.id);
  const at = stepAt(p, elapsedSec());
  let acc = 0;
  for (let i = 0; i <= at.i; i++) acc += stepDur(p.steps[i]);
  const target = Math.min(acc, totalSec(p));
  run.start = (run.pausedAt || Date.now()) - run.pausedMs - target * 1000;
  track('для себя:минутка дальше');
  if (target >= totalSec(p)) finish(); else emit();
}

// Где мы в тексте: номер шага, идёт ли тишина после слов, сколько секунд до следующего шага
export function stepAt(p, sec) {
  let acc = 0;
  for (let i = 0; i < p.steps.length; i++) {
    const st = p.steps[i];
    const d = stepDur(st);
    if (sec < acc + d) return { i, quiet: sec - acc >= (st.r || 0), left: acc + d - sec };
    acc += d;
  }
  return { i: p.steps.length - 1, quiet: true, left: 0, end: true };
}
// Текст шага; у шага-подсказки («Ещё три раза со счётом») — текст предыдущего шага
export function stepText(p, i) {
  const st = p.steps[i];
  if (st.t) return { text: st.t, hint: '' };
  for (let j = i - 1; j >= 0; j--) if (p.steps[j].t) return { text: p.steps[j].t, hint: st.h };
  return { text: '', hint: st.h };
}

export const savedItem = (p) => ({ kind: 'practice', id: p.id, title: p.title, sub: `${p.min} мин · Минутка для себя`, route: `/dlya-sebya/minutka/${p.id}` });

// Подписка экрана на практику и сверка паузы с мини-плеером
export function usePractice() {
  const [, f] = useState(0);
  useEffect(() => { const l = () => f((x) => x + 1); subs.add(l); return () => subs.delete(l); }, []);
  const pl = usePlayer();
  useEffect(() => {
    if (!run || run.done || !pl || pl.id !== PLAYER_ID) return;
    if (pl.paused && !run.pausedAt) { run.pausedAt = Date.now(); emit(); }
    else if (!pl.paused && run.pausedAt) { run.pausedMs += Date.now() - run.pausedAt; run.pausedAt = null; emit(); }
  }, [pl && pl.paused, pl && pl.id]);
  return run;
}
