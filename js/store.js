// Всё хранится на этом телефоне: localStorage для записей, IndexedDB для фото.
// На сервер ничего не уходит.
import { useState, useEffect } from './lib.js?v=22';

const KEY = 'nen-veb-1';

const fresh = () => ({
  v: 1,
  createdAt: Date.now(),
  onboarded: false,
  stage: null,            // 'born' | 'expecting' | 'planning'
  children: [],           // { id, name, dob, sex, gestWeeks, photo, expecting, due, twinOf }
  activeChildId: null,
  topics: [],             // 'sleep' | 'food' | 'development' | 'health' | 'emotions' | 'self'
  records: [],            // { id, childId, type, start, end, data, at }
  tasks: [],              // дела: { id, childId, title, when, kind, done }
  notes: [],              // мои заметки: { id, text, at }
  moments: [],            // { id, childId, text, photo, at }
  saved: [],              // сохранённое: { kind, id, title, sub, route, at }
  seen: {},               // что человек уже видел: { news: [...], facts: {...} }
  dismissed: [],          // карточки «Не показывать»
  done: {},               // отметки: занятия, ориентиры, практики — { key: time }
  settings: { hiddenButtons: [], city: 'Москва', lastFeed: null },
  account: null,          // в веб-версии вход выключен
  demo: {},               // режим показа для встреч: { course, club, timeOfDay }
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) { /* пусто или нет доступа */ }
  return fresh();
}

let state = load();
const listeners = new Set();

// Можно ли хранить записи в этом браузере. Нельзя — в частном режиме, при запрете cookie
// и в некоторых встроенных браузерах: тогда записи живут, пока открыта страница.
export const storage = { ok: true, error: '' };
try { localStorage.setItem('nen-veb-test', '1'); localStorage.removeItem('nen-veb-test'); } catch (e) { storage.ok = false; storage.error = String(e && e.name || e); }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storage.ok = true; } catch (e) { storage.ok = false; storage.error = String(e && e.name || e); }
}

// structuredClone есть не на всех айфонах (Safari с 15.4): без него не сохранялось ничего — ни ребёнок,
// ни записи. Запасной путь — через JSON: в состоянии только данные.
const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export const getState = () => state;

export function update(fn) {
  const draft = clone(state);
  const r = fn(draft);
  state = r || draft;
  save();
  listeners.forEach((l) => l(state));
}

export function resetAll() {
  state = fresh();
  save();
  listeners.forEach((l) => l(state));
}

export function replaceAll(next) {
  state = { ...fresh(), ...next };
  save();
  listeners.forEach((l) => l(state));
}

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return state;
}

// Перерисовка раз в N секунд — для таймеров и «сколько прошло»
export function useTick(ms = 1000) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function activeChild(s = state) {
  return s.children.find((c) => c.id === s.activeChildId) || s.children[0] || null;
}
export function bornChildren(s = state) { return s.children.filter((c) => !c.expecting); }

// Режим показа: на встречах можно поставить вечер или ночь, не дожидаясь их.
export function now() {
  const t = Date.now();
  const tod = state.demo && state.demo.timeOfDay;
  if (!tod) return t;
  const d = new Date(t);
  const hours = { day: 14, evening: 20, night: 3 }[tod];
  d.setHours(hours, d.getMinutes(), d.getSeconds(), d.getMilliseconds()); // секунды идут — таймеры тикают и в режиме показа
  return d.getTime();
}

// Сохранённое (сердечко в шапке)
export function isSaved(kind, id) { return state.saved.some((x) => x.kind === kind && x.id === id); }
export function toggleSaved(item) {
  let added = false;
  update((s) => {
    const i = s.saved.findIndex((x) => x.kind === item.kind && x.id === item.id);
    if (i >= 0) s.saved.splice(i, 1);
    else { s.saved.unshift({ ...item, at: Date.now() }); added = true; }
  });
  return added;
}

// Фото — в IndexedDB, уменьшенные до 1200 px
const DB = 'nen-veb-photos';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
// Фото не мешает сохранить остальное: не уменьшилось или не записалось — вернём null
export async function savePhoto(file) {
  try { return await savePhotoStrict(file); } catch (e) { console.warn('Фото не сохранилось', e); return null; }
}
async function savePhotoStrict(file) {
  const url = await shrink(file, 1200);
  const id = uid();
  const db = await idb();
  await new Promise((res, rej) => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').put(url, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  return id;
}
export async function getPhoto(id) {
  if (!id) return null;
  const db = await idb();
  return new Promise((res) => { const r = db.transaction('p').objectStore('p').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
}
export function usePhoto(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let on = true; getPhoto(id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id]);
  return url;
}
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
