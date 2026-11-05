// «Идея на сегодня» — экран 8 и карточка на главном. Рецепт открыт всем, без входа.
import { html } from '../../lib.js?v=19';
import { useStore } from '../../store.js?v=19';
import { Ill } from '../../ui.js?v=19';
import { go } from '../../router.js?v=19';
import { track } from '../../stats.js?v=19';
import { ARTICLES } from '../../content/articles.js?v=19';
import { recipeById } from '../../content/moy-nen-kuhnya.js?v=19';
import { Inner, ideaToday, openSite, useOffline } from './util.js?v=19';

const line = (r) => r.line || `Из подборки НЭН «${r.source.title}».`;
const openIdea = (r) => { track('мой-нэн:идея'); go('/moy-nen/ideya?id=' + r.id); };

// Карточка на главном (экраны 1, 2, 9, 15–18)
export function IdeaCard({ r }) {
  if (!r) return null;
  return html`
    <div class="card" onClick=${() => openIdea(r)}>
      <${Ill} text="Фото блюда" />
      <div class="mn-eyebrow">Идея на сегодня · Семейная кухня</div>
      <div class="mn-title">${r.title}</div>
      <p class="lead">${line(r)}</p>
      <div class="actions"><button onClick=${(e) => { e.stopPropagation(); openIdea(r); }}>Рецепт</button></div>
    </div>`;
}

// ——— Экран 8. Рецепт целиком ———
function Idea({ query }) {
  const s = useStore();
  const offline = useOffline(s, query);
  const r = (query.id && recipeById(query.id)) || ideaToday();
  if (!r) {
    return html`<div class="screen"><${Inner} title="Идея на сегодня" />
      <p class="lead">Новая идея из «Семейной кухни» появится здесь завтра.</p>
      <button class="btn btn-gray" onClick=${() => go('/moy-nen/pochitat')}>Почитать пока статьи</button></div>`;
  }
  const src = ARTICLES.find((a) => a.url === r.source.url);
  const steps = r.steps;
  const tip = r.tip && r.tip.charAt(0).toUpperCase() + r.tip.slice(1);
  return html`
    <div class="screen">
      <${Inner} eyebrow="Идея на сегодня · Семейная кухня" title=${r.title} />
      <${Ill} big text="Фото блюда" />
      ${r.line && html`<p class="lead">${r.line}</p>`}
      <h2 class="h3">Продукты</h2>
      <ul class="mn-list">${r.ingredients.map((x) => html`<li>${x}</li>`)}</ul>
      <h2 class="h3">Как приготовить</h2>
      ${steps.length > 1
        ? html`<ol class="mn-list">${steps.map((x) => html`<li>${x}</li>`)}</ol>`
        : html`<p class="p">${steps[0]}</p>`}
      ${tip && html`<div class="note-box">Совет: ${tip}</div>`}
      <p class="tiny">Из подборки НЭН ${src
        ? html`<button class="mn-link" onClick=${() => { track('мой-нэн:идея-источник'); go('/statya/' + src.id); }}>«${r.source.title}»</button>`
        : offline ? `«${r.source.title}»` : html`<button class="mn-link" onClick=${() => openSite(r.source.url, 'идея-источник')}>«${r.source.title}»</button>`}</p>
      <p class="small">Завтра здесь — новая идея.</p>
      <div class="card-gray">
        <div class="mn-eyebrow">Клуб НЭН</div>
        <div class="h3">Ещё рецепты, продукты дома и своя книга</div>
        <p class="small">В полном Клубе — все рецепты «Семейной кухни», подбор по тому, что есть дома, и список «Что не ест».</p>
        <div class="actions"><button onClick=${() => { track('мой-нэн:идея-клуб'); go('/moy-nen/klub'); }}>Клуб ›</button></div>
      </div>
    </div>`;
}

export const ideyaRoutes = [{ path: '/moy-nen/ideya', view: Idea }];
