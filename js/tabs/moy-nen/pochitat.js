// «Почитать — все» — экран 4: «Сегодня в НЭН» за неделю и все статьи для возраста, новые сверху.
import { html, useState } from '../../lib.js?v=18';
import { useStore, isSaved, now } from '../../store.js?v=18';
import { dayKey } from '../../age.js?v=18';
import { SecTitle } from '../../ui.js?v=18';
import { freshWeek } from '../../content/articles.js?v=18';
import { Inner, ArticleRow, readingFor } from './util.js?v=18';

const savedSub = (a) => (isSaved('article', a.id) ? '✓ Сохранено' : null);

function Pochitat({ query }) {
  const s = useStore();
  const [more, setMore] = useState(false);
  const r = readingFor(s);
  const week = query.sostoyanie === 'pusto' ? [] : freshWeek(dayKey(now()));
  const fresh = more ? week : week.slice(0, 3);
  return html`
    <div class="screen">
      <${Inner} title="Почитать" />
      ${fresh.length > 0 && html`
        <${SecTitle}>Сегодня в НЭН<//>
        <div class="rows">${fresh.map((a) => html`<${ArticleRow} a=${a} from="сегодня-в-нэн" sub=${savedSub(a)} />`)}</div>
        ${!more && week.length > 3 && html`<button class="btn-quiet mn-left" onClick=${() => setMore(true)}>Ещё за неделю — ${week.length - 3}</button>`}`}
      <${SecTitle}>${r.forWhom} · новые сверху<//>
      <div class="rows">${r.list.map((a) => html`<${ArticleRow} a=${a} from="почитать-все" sub=${savedSub(a)} />`)}</div>
      ${!r.list.length && html`<p class="empty">Статьи для этого возраста появятся здесь — новое отметим точкой на колокольчике.</p>`}
    </div>`;
}

export const pochitatRoutes = [{ path: '/moy-nen/pochitat', view: Pochitat }];
