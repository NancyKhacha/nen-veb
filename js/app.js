// Каркас: какой экран показать, шапка, полоса записи, меню, листы и сообщения.
import { html, render, useEffect } from './lib.js';
import { useStore, now, getState } from './store.js';
import { addRoutes, match, useRoute, go } from './router.js';
import { Menu, OverlayHost, AskButton } from './ui.js';
import { RecordStrip } from './strip.js';
import { MiniPlayer } from './player.js';
import { partOfDay } from './age.js';
import { trackOpen } from './stats.js';
import { onboardingRoutes } from './onboarding.js';
import { commonRoutes, setTabModules } from './common.js';
import { profileRoutes } from './profile.js';
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
addRoutes(commonRoutes);

function App() {
  const s = useStore();
  const { path, query } = useRoute();
  const free = path.startsWith('/start') || path === '/s';

  useEffect(() => {
    if (!s.onboarded && !free) go('/start', { replace: true });
    else if (s.onboarded && (path === '/' || path === '' || path === '/start')) go('/segodnya', { replace: true });
  }, [s.onboarded, path]);

  const m = match(path) || match('/segodnya');
  const r = m.route;
  const night = r.night && partOfDay(now()) === 'night';
  useEffect(() => { document.body.classList.toggle('night', !!night); }, [night]);
  useEffect(() => { const el = document.querySelector('.scroll'); if (el) el.scrollTop = 0; }, [path]);

  const View = r.view;
  if (r.solo) {
    return html`<div class="app"><div class="scroll"><${View} params=${m.params} query=${query} /></div><${OverlayHost} /></div>`;
  }
  return html`
    <div class="app">
      <div class="scroll"><${View} params=${m.params} query=${query} /></div>
      <div class="bottom">
        ${!r.noAsk && html`<${AskButton} />`}
        <${MiniPlayer} />
        ${r.strip && html`<${RecordStrip} />`}
        <${Menu} tab=${r.tab} />
      </div>
      <${OverlayHost} bottomOffset=${r.strip ? 190 : 86} />
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));

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
