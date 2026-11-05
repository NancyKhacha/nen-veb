// Вкладка «Мой НЭН» — Фигма «35 · V3 · Мой НЭН», бриф docs/razdely/moy-nen.md.
// Что почитать и что продолжить: статьи НЭН, «Сегодня в НЭН», «Идея на сегодня», Школа и Клуб.
// Экраны — в папке moy-nen/; читалка /statya/:id — общая для всех вкладок.
import { homeRoutes } from './moy-nen/home.js?v=18';
import { readerRoutes, articleSearch } from './moy-nen/reader.js?v=18';
import { pochitatRoutes } from './moy-nen/pochitat.js?v=18';
import { kursRoutes } from './moy-nen/kurs.js?v=18';
import { klubRoutes } from './moy-nen/klub.js?v=18';
import { ideyaRoutes } from './moy-nen/ideya.js?v=18';
import { stripHere } from './moy-nen/util.js?v=18';

// Полоса записи — как на «Сегодня»: с трёх лет на этой вкладке её нет (экран 9).
// Тёмная тема ночью — как у всех вкладок: отдельного ночного экрана нет.
const tabbed = (r) => ({ ...r, tab: '/moy-nen', night: true, get strip() { return stripHere(); } });

export const routes = [
  ...homeRoutes, ...readerRoutes, ...pochitatRoutes, ...kursRoutes, ...klubRoutes, ...ideyaRoutes,
].map(tabbed);

// Поиск: все статьи, курс и Клуб
export function searchItems() {
  return [
    ...articleSearch(),
    { title: 'Первый год с малышом', sub: 'Школа НЭН · урок на каждый месяц', path: '/moy-nen/kurs', text: 'курс школа уроки первый год' },
    { title: 'Клуб НЭН', sub: 'Эфиры, записи, подарки партнёров, встречи', path: '/moy-nen/klub', text: 'клуб эфир вопрос карта участника подарки' },
    { title: 'Идея на сегодня', sub: 'Семейная кухня · рецепт дня', path: '/moy-nen/ideya', text: 'рецепт кухня ужин готовить идея' },
  ];
}
