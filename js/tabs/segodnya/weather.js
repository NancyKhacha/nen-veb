// Погода на «Сегодня»: Open-Meteo без ключа, по городу из профиля. Последний прогноз хранится
// на телефоне (s.weather) — без сети показываем его со временем, как приложение: «последний прогноз».
import { html, useEffect, useState } from '../../lib.js?v=16';
import { getState, update, now } from '../../store.js?v=16';
import { startOfDay, hhmm, dateLong } from '../../age.js?v=16';

// Координаты — из каталога городов приложения (GeoNames, округлены до 0,1°)
export const CITIES = {
  'Москва': [55.8, 37.6], 'Санкт-Петербург': [59.9, 30.3], 'Новосибирск': [55.0, 82.9], 'Екатеринбург': [56.9, 60.6],
  'Казань': [55.8, 49.1], 'Нижний Новгород': [56.3, 44.0], 'Краснодар': [45.0, 39.0], 'Самара': [53.2, 50.1],
  'Ростов-на-Дону': [47.2, 39.7], 'Уфа': [54.7, 56.0],
};

const CODES = [
  [[0], 'ясно', 'sun'], [[1], 'в основном ясно', 'sun'], [[2], 'переменная облачность', 'part'], [[3], 'облачно', 'cloud'],
  [[45, 48], 'туман', 'fog'], [[51, 53, 55], 'морось', 'rain'], [[56, 57], 'ледяная морось', 'rain'],
  [[61, 63], 'дождь', 'rain'], [[65], 'сильный дождь', 'rain'], [[66, 67], 'ледяной дождь', 'rain'],
  [[71, 73], 'снег', 'snow'], [[75], 'сильный снег', 'snow'], [[77], 'снежная крупа', 'snow'],
  [[80, 81], 'ливень', 'rain'], [[82], 'сильный ливень', 'rain'], [[85, 86], 'снегопад', 'snow'],
  [[95], 'гроза', 'storm'], [[96, 99], 'гроза с градом', 'storm'],
];
export function describeCode(code) {
  const c = CODES.find(([list]) => list.includes(code));
  return c ? { word: c[1], icon: c[2] } : { word: '', icon: 'cloud' };
}
const temp = (t) => { const r = Math.round(t); return r > 0 ? `+${r}°` : r < 0 ? `−${Math.abs(r)}°` : '0°'; };
export function weatherLine(w) {
  const d = describeCode(w.code);
  return [temp(w.t), d.word, `ветер ${Math.round(w.wind)} м/с`].filter(Boolean).join(', ');
}

export const isOffline = () => !!(getState().demo && getState().demo.offline) || (typeof navigator !== 'undefined' && navigator.onLine === false);

let loading = false;
export async function refreshWeather(force = false) {
  const s = getState();
  const city = s.settings.city || 'Москва';
  const w = s.weather;
  const fresh = w && w.city === city && Date.now() - w.at < 30 * 60000;
  if (loading || isOffline() || (fresh && !force)) return;
  const ll = CITIES[city];
  if (!ll) return;
  loading = true;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ll[0]}&longitude=${ll[1]}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=auto`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('weather ' + r.status);
    const j = await r.json();
    const c = j && j.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new Error('weather body');
    update((d) => { d.weather = { city, at: Date.now(), t: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m }; });
  } catch (e) { /* без сети или сервис недоступен — остаётся последний прогноз */ }
  finally { loading = false; }
}

// Сеть пропала или появилась — перерисовать и, если надо, обновить прогноз
export function useOnline() {
  const [on, setOn] = useState(!isOffline());
  useEffect(() => {
    const f = () => { setOn(!isOffline()); refreshWeather(); };
    window.addEventListener('online', f);
    window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); };
  }, []);
  return on;
}

// Подпись «последний прогноз, 9:40» — когда показываем сохранённое
export function staleLabel(w, t = now()) {
  if (!w) return '';
  const when = startOfDay(w.at) === startOfDay(t) ? hhmm(w.at) : `${dateLong(w.at)}, ${hhmm(w.at)}`;
  return `последний прогноз, ${when}`;
}

// Иконка погоды — простые линии, как в голых экранах
export function WeatherIcon({ kind }) {
  const sun = html`<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>`;
  const cloud = html`<path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 9.5 4.3 4.3 0 0 0 7 18z"/>`;
  const body = {
    sun,
    part: html`<circle cx="9" cy="9" r="3.2"/><path d="M9 2.8v1.6M2.8 9h1.6M4.6 4.6l1.1 1.1M13.4 4.6l-1.1 1.1"/><path d="M9 19h9a3.4 3.4 0 0 0 .4-6.8A4.7 4.7 0 0 0 9.2 12 3.5 3.5 0 0 0 9 19z"/>`,
    cloud,
    fog: html`${cloud}<path d="M5 21h14"/>`,
    rain: html`<path d="M7 15h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>`,
    snow: html`<path d="M7 15h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M9 19h.01M13 20h.01M17 19h.01M11 22h.01M15 22h.01"/>`,
    storm: html`<path d="M7 15h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 6.5 4.3 4.3 0 0 0 7 15z"/><path d="M12 16l-2 3.5h3L11 23"/>`,
  }[kind] || cloud;
  return html`<svg class="sg-wicon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
