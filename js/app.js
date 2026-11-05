// Каркас: какой экран показать, шапка, полоса записи, меню, листы и сообщения.
import { html, render, useEffect, useState } from './lib.js';
import { useStore, now, getState, storage } from './store.js';
import { addRoutes, match, useRoute, go } from './router.js';
import { Menu, OverlayHost, AskButton, openSheet } from './ui.js';
import { RecordHub, RunningPill } from './strip.js';
import { MiniPlayer } from './player.js';
import { partOfDay } from './age.js';
import { trackOpen } from './stats.js';
import { onboardingRoutes, isPreview, markPreview, endPreview } from './onboarding.js';
import { back } from './router.js';
import { commonRoutes, setTabModules } from './common.js';
import { profileRoutes } from './profile.js';
import { semyaRoutes } from './semya.js';
import { Header, setNewsCheck } from './ui.js';

// Вкладки грузятся по отдельности: ошибка в одной не роняет остальные
const TABS = [['segodnya', '/segodnya', 'Сегодня'], ['rebyonok', '/rebyonok', 'Ребёнок'], ['dlya-sebya', '/dlya-sebya', 'Для себя'], ['moy-nen', '/moy-nen', 'Мой НЭН']];
const mods = await Promise.all(TABS.map(async ([file, path, label]) => {
  try { return await import(`./tabs/${file}.js`); }
  catch (e) {
    console.error('Вкладка не загрузилась:', file, e);
    const Broken = () => html`<div class="screen"><${Header} /><p class="lead">«${label}» сейчас обновляется. Загляните чуть позже — записи на месте.</p></div>`;
    return { routes: [{ path, view: Broken, tab: path, strip: true }], searchItems: () => [] };
  }
}));
setTabModules(mods);
const news = mods.find((m) => m.hasNews);
if (news) setNewsCheck(news.hasNews);

addRoutes(onboardingRoutes);
mods.forEach((m) => addRoutes(m.routes || []));
addRoutes(profileRoutes);
addRoutes(semyaRoutes);
addRoutes(commonRoutes);

// Экран загрузки: логотип НЭН и одна строка о том, что это (журнал, 4 ноября).
// Один раз за запуск, полторы секунды; касание пропускает.
function Splash() {
  const [st, setSt] = useState(() => { try { return sessionStorage.getItem('nen-splash') ? 'gone' : 'on'; } catch (e) { return 'on'; } });
  useEffect(() => {
    if (st !== 'on') return undefined;
    try { sessionStorage.setItem('nen-splash', '1'); } catch (e) { /* без хранилища тоже покажем */ }
    const t1 = setTimeout(() => setSt('out'), 1500);
    const t2 = setTimeout(() => setSt('gone'), 1950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (st === 'gone') return null;
  return html`
    <div class=${'splash' + (st === 'out' ? ' out' : '')} role="status" onClick=${() => setSt('gone')}>
      <img src="img/logo.svg" alt="НЭН" />
      <div class="t">Нет, это нормально</div>
      <div class="s">Дневник ребёнка и редакция НЭН — в одном приложении</div>
    </div>`;
}

function App() {
  const s = useStore();
  const { path, query } = useRoute();
  const free = path.startsWith('/start') || path === '/s' || path === '/semya/kod';
  if (path === '/start' && query && query.pokaz) markPreview();
  if (!path.startsWith('/start') && isPreview()) endPreview();

  useEffect(() => {
    if (!s.onboarded && !free) go('/start', { replace: true });
    // Первый вход пройден: его шаги открываются только показом (не «назад» в анкету ребёнка)
    else if (s.onboarded && !isPreview() && (path === '/' || path === '' || ['/start', '/start/rebyonok', '/start/zhdyom', '/start/temy'].includes(path))) go('/segodnya', { replace: true });
  }, [s.onboarded, path]);

  const m = match(path) || match('/segodnya');
  const r = m.route;
  const night = r.night && partOfDay(now()) === 'night';
  useEffect(() => { document.body.classList.toggle('night', !!night); }, [night]);
  useEffect(() => { const el = document.querySelector('.scroll'); if (el) el.scrollTop = 0; }, [path]);

  const View = r.view;
  const noStore = !storage.ok && html`<div class="store-warn" role="alert">Этот браузер не даёт сохранять записи — так бывает в частном режиме, при запрете cookie и во встроенном браузере мессенджера. Откройте ссылку в обычном окне Safari или Chrome.</div>`;
  if (r.solo) {
    return html`<div class="app">${noStore}<div class="scroll"><${View} params=${m.params} query=${query} /></div><${OverlayHost} /><${Splash} /></div>`;
  }
  return html`
    <div class="app">
      ${noStore}
      <div class="scroll"><${View} params=${m.params} query=${query} /></div>
      <div class="bottom">
        ${!r.noAsk && html`<${AskButton} />`}
        <${MiniPlayer} />
        ${path !== '/segodnya' && html`<${RunningPill} />`}
        <${Menu} tab=${r.tab} onRecord=${() => openSheet(RecordHub)} running=${s.records.some((x) => x.end == null && ['sleep', 'feed', 'walk'].includes(x.type))} />
      </div>
      <${OverlayHost} bottomOffset=${r.strip ? 190 : 86} />
      <${Splash} />
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));

// Свайп от левого края — назад. Только в приложении на экране телефона: в браузере свой жест.
const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
if (standalone) {
  let sx = null; let sy = 0;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX < 24 ? t.clientX : null; sy = t.clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const t = e.changedTouches[0];
    const root = ['/segodnya', '/rebyonok', '/dlya-sebya', '/moy-nen'].includes(location.hash.replace(/^#/, '').split('?')[0]);
    if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60 && !root) back();
    sx = null;
  }, { passive: true });
}

// Ошибка — не тишина: короткое сообщение, по которому понятно, что пошло не так (снимок экрана — нам)
let lastErr = 0;
const showErr = (msg) => {
  if (Date.now() - lastErr < 4000) return;
  lastErr = Date.now();
  import('./ui.js').then(({ toast }) => toast({ text: `Не получилось. Если повторится, пришлите снимок экрана: ${String(msg).slice(0, 120)}`, ms: 7000 }));
};
window.addEventListener('error', (e) => showErr(e.message || e.error));
window.addEventListener('unhandledrejection', (e) => showErr((e.reason && (e.reason.message || e.reason.name)) || e.reason));

trackOpen();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') trackOpen(); });

// На своём компьютере кэш не включаем: правки видны сразу после обновления страницы.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !local) {
  // Пришла новая версия кэша — один раз перезагружаемся, чтобы показать свежее
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
}
