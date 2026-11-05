// Главный «Мой НЭН» — экраны 1, 2, 9, 11, 12, 14–18 Фигмы «35 · V3 · Мой НЭН».
// Сверху — что начато (урок, эфир), потом продукты НЭН (Школа, Клуб), потом статьи и идея дня
// (журнал, 5 ноября: было — продукты в конце).
// Состояния для показа: #/moy-nen?sostoyanie=pusto | bez-seti | pervyy-zapusk | bez-akkaunta
import { html } from '../../lib.js?v=25';
import { useStore, activeChild, now } from '../../store.js?v=25';
import { Header, Row, SecTitle, Ill, SaveButton } from '../../ui.js?v=25';
import { go } from '../../router.js?v=25';
import { track } from '../../stats.js?v=25';
import { playNoise } from '../../player.js?v=25';
import {
  access, useOffline, readingFor, todays, freshToday, ideaToday, openArticle, ArticleRow, savedItem, courseFor,
} from './util.js?v=25';
import { ContinueCard, SchoolRow } from './kurs.js?v=25';
import { ClubBlock, ClubInvite } from './klub.js?v=25';
import { IdeaCard } from './ideya.js?v=25';

// Первая статья для возраста — карточкой
function ArticleCard({ a }) {
  return html`
    <div class="card" onClick=${() => openArticle(a, 'статья')}>
      <${Ill} id=${a.id} />
      <div class="mn-title">${a.title}</div>
      <p class="lead">${a.lead}</p>
      <div class="actions" onClick=${(e) => e.stopPropagation()}>
        <button onClick=${() => openArticle(a, 'статья')}>Читать</button>
        <${SaveButton} item=${savedItem(a)} />
      </div>
    </div>`;
}

// Экран 14: первый запуск без сети — что придёт само и что работает уже сейчас
function FirstLaunch({ band }) {
  return html`
    <div class="card">
      <div class="mn-eyebrow">Без сети</div>
      <div class="mn-title">Статьи придут, как только появится сеть</div>
      <p class="lead">Подборка${band ? ' для ' + band : ''} загрузится сама, новое — точкой на колокольчике. А пока — то, что уже есть в телефоне.</p>
    </div>
    <${SecTitle}>Работает без сети<//>
    <div class="rows">
      <${Row} title="Белый шум" sub="Включится сразу · в «Ребёнке»" onClick=${() => { track('мой-нэн:шум'); playNoise('white'); go('/rebyonok/skazki'); }} />
      <${Row} title="Когда поговорить с врачом" sub="Признаки, с которыми не ждут" onClick=${() => { track('мой-нэн:справочник'); go('/rebyonok/razvitie/k-vrachu'); }} />
      <${Row} title="Сон, экраны и движение" sub="Сколько спать, смотреть экран и двигаться" onClick=${() => { track('мой-нэн:справочник'); go('/rebyonok/razvitie/son-ekrany'); }} />
    </div>`;
}

function Home({ query }) {
  const s = useStore();
  const t = now();
  const st = query.sostoyanie;
  const acc = access(s, query);
  const offline = useOffline(s, query);
  const first = st === 'pervyy-zapusk';
  const empty = st === 'pusto';
  const child = activeChild(s);
  const course = child && !child.expecting ? courseFor(s, t) : null;
  const r = readingFor(s, t);
  const top = todays(r.list, t, 3);
  const fresh = empty || first ? [] : freshToday(t);
  const idea = empty || first ? null : ideaToday(t);
  const showContinue = acc.course && course && course.code === 'firstyear' && !first;

  return html`
    <div class="screen">
      <${Header} />
      ${showContinue && html`<${ContinueCard} s=${s} course=${course} offline=${offline} />`}
      ${acc.club === 'paid' && !first && html`<${ClubBlock} acc=${acc} offline=${offline} />`}

      ${first
        ? html`
          ${course && html`<${SchoolRow} s=${s} acc=${{ ...acc, course: false }} course=${course} offline=${true} />`}
          <${SecTitle}>Клуб НЭН<//><${ClubInvite} loggedIn=${acc.loggedIn} offline=${true} />`
        : html`
          ${!showContinue && html`<${SchoolRow} s=${s} acc=${acc} course=${course} offline=${offline} />`}
          ${acc.club !== 'paid' && html`<${ClubBlock} acc=${acc} offline=${offline} />`}`}

      ${first
        ? html`<${SecTitle}>Почитать<//><${FirstLaunch} band=${r.band} />`
        : html`
          <${SecTitle} more="Все" onMore=${() => { track('мой-нэн:почитать-все'); go('/moy-nen/pochitat'); }}>Почитать<//>
          ${top[0] && html`<${ArticleCard} a=${top[0]} />`}
          <div class="rows">${top.slice(1).map((a) => html`<${ArticleRow} a=${a} />`)}</div>
          ${fresh.length > 0 && html`
            <${SecTitle}>Сегодня в НЭН<//>
            <div class="rows">${fresh.map((a) => html`<${ArticleRow} a=${a} from="сегодня-в-нэн" />`)}</div>`}
          ${!fresh.length && r.list.length > 1 && html`<p class="small">Завтра сверху — другая статья${r.band ? ' для ' + r.band : ''}.</p>`}
          ${offline && html`<p class="small">Без сети: статьи этой версии уже в телефоне и читаются целиком.</p>`}`}

      ${idea && html`<${IdeaCard} r=${idea} />`}
    </div>`;
}

export const homeRoutes = [{ path: '/moy-nen', view: Home }];
