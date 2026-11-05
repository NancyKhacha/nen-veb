// Клуб НЭН — экраны 6, 7, 10, 15 и карточка Клуба на главном (экраны 1, 2, 12, 14, 18).
// В веб-версии вход выключен: Клуб — для примера, по флагу «В Клубе» в «Для исследования».
import { html, useState } from '../../lib.js?v=17';
import { useStore, now } from '../../store.js?v=17';
import { dateLong } from '../../age.js?v=17';
import { Row, SecTitle, Pill, openSheet, closeSheet, toast } from '../../ui.js?v=17';
import { go } from '../../router.js?v=17';
import { track } from '../../stats.js?v=17';
import { mn, setMN, access, useOffline, Inner, EFIR, RECORDS, nextEfir, efirWhen, efirDayAcc, efirFits } from './util.js?v=17';

const TRIAL = 'В пробной версии Клуб показан для примера: здесь этого нет.';
const trial = (what) => { track('мой-нэн:клуб-' + what); toast({ text: TRIAL, ms: 3500 }); };
const endOfMonth = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime(); };

// ——— Ближайший эфир: «Напомнить за час», «Задать вопрос», статус вопроса ———
export function EfirCard({ big, offline }) {
  const s = useStore();
  const t = now();
  const at = nextEfir(t);
  const m = mn(s);
  const reminded = m.reminder === at;
  const q = m.question;
  const remind = () => {
    if (reminded) {
      setMN((x) => { x.reminder = null; });
      track('мой-нэн:эфир-не-напоминать');
      return toast({ text: 'Напоминание убрали', ms: 2000 });
    }
    setMN((x) => { x.reminder = at; });
    track('мой-нэн:эфир-напомнить');
    toast({ text: `Напомним ${efirDayAcc(at, t)} в ${EFIR.hour - 1}:00`, actions: [{ label: 'Отменить', onClick: () => setMN((x) => { x.reminder = null; }) }] });
  };
  let status = null;
  if (q && q.efirAt === at) status = 'Ваш вопрос получен';
  else if (q && q.efirAt < at && t - q.efirAt < 8 * 864e5) status = `Ваш вопрос разобран в эфире ${dateLong(q.efirAt)}`;
  const fits = efirFits(s, t);
  const when = efirWhen(at, t);
  const text = offline ? 'Вопрос можно написать сейчас — черновик останется в телефоне.'
    : (fits ? fits + ' ' : '') + 'Можно спросить заранее и анонимно — ответ прозвучит в эфире.';
  return html`
    <div class="card">
      <div class="mn-eyebrow">${big ? when.charAt(0).toUpperCase() + when.slice(1) : 'Эфир · ' + when}</div>
      <div class="mn-title">${EFIR.title}</div>
      <p class="lead">${text}</p>
      ${status && html`<p class="small">✓ ${status}</p>`}
      <div class="actions">
        ${offline
          ? html`<button onClick=${() => openSheet(AskSheet, { at })}>Задать вопрос</button><button class="mn-pale" disabled>Напомнить за час</button>`
          : html`<button onClick=${remind}>${reminded ? 'Убрать напоминание' : 'Напомнить за час'}</button><button onClick=${() => { track('мой-нэн:эфир-вопрос'); openSheet(AskSheet, { at }); }}>Задать вопрос</button>`}
      </div>
    </div>`;
}

// ——— Экран 7. Вопрос к эфиру: лист, черновик хранится на телефоне ———
function AskSheet({ at }) {
  const s = useStore();
  const m = mn(s);
  const offline = useOffline(s);
  const text = m.draft || '';
  const anon = m.anon !== false;
  const send = () => {
    setMN((x) => { x.question = { anon, at: now(), efirAt: at }; x.draft = ''; });
    track('мой-нэн:вопрос-отправлен');
    closeSheet();
    toast({ text: 'Вопрос получен', ms: 2500 });
  };
  return html`
    <div class="h2">Вопрос к эфиру</div>
    <p class="small">${EFIR.title} · ${efirDayAcc(at).replace(/^во? /, '')}, ${EFIR.hour}:00</p>
    <label class="field"><span class="label">Ваш вопрос</span>
      <textarea value=${text} placeholder="Например, засыпает только на руках — это нормально в два месяца?"
        onInput=${(e) => { const v = e.target.value; setMN((x) => { x.draft = v; }); }}></textarea></label>
    <div class="pills"><${Pill} on=${anon} onClick=${() => setMN((x) => { x.anon = !anon; })}>Анонимно<//></div>
    <p class="small">${anon ? 'Имя не прозвучит в эфире.' : 'Имя прозвучит в эфире.'} Ответ — в эфире ${efirDayAcc(at)}.</p>
    <p class="tiny">Пробная версия: вопрос остаётся на этом телефоне и никуда не уходит.</p>
    ${offline
      ? html`<button class="btn btn-primary" disabled>Отправить — когда появится сеть</button><p class="tiny center">Черновик останется в телефоне.</p>`
      : html`<button class="btn btn-primary" disabled=${!text.trim()} onClick=${send}>Отправить</button>`}`;
}

// ——— Экран 10. Карта участника: лист ———
function CardSheet({ level }) {
  const s = useStore();
  const offline = useOffline(s);
  return html`
    <div class="h2">Карта участника</div>
    <p class="small">${level === 'paid' ? 'Платный Клуб' : 'Бесплатный Клуб'} · карта активна</p>
    <div class="mn-num">0042 1873</div>
    <p class="small">Покажите номер партнёру. Если партнёр просит проверку — откройте ссылку, она действует недолго.</p>
    <p class="tiny">Пробная версия: номер — для примера.</p>
    <div class="pills">
      <button class=${'pill' + (offline ? ' mn-pale' : '')} disabled=${offline} onClick=${() => trial('карта-ссылка')}>Ссылка для проверки</button>
      <button class=${'pill' + (offline ? ' mn-pale' : '')} disabled=${offline} onClick=${() => trial('карта-кошелёк')}>В кошелёк</button>
    </div>
    ${offline && html`<p class="tiny">Ссылка и кошелёк — когда появится сеть. Номер виден и так.</p>`}
    <button class="btn btn-primary" onClick=${closeSheet}>Готово</button>`;
}
export const openCard = (level) => { track('мой-нэн:карта'); openSheet(CardSheet, { level }); };

// ——— Вступить: в веб-версии — показать бесплатный Клуб для примера ———
function JoinSheet({ loggedIn }) {
  const join = () => {
    setMN((x) => { x.freeClub = true; });
    track('мой-нэн:клуб-вступить-пример');
    closeSheet();
    toast({ text: 'Вы в бесплатном Клубе — карта участника уже здесь', ms: 3500 });
  };
  return html`
    <div class="h2">${loggedIn ? 'Бесплатный Клуб' : 'Вход и Клуб'}</div>
    <p class="lead">Бесплатный Клуб даёт карту участника, подарки партнёров и встречи один на один. Нужна короткая анкета, оплаты нет.</p>
    <p class="small">${loggedIn ? 'В пробной версии анкеты нет: Клуб можно посмотреть для примера, карта и подарки — не настоящие.'
      : 'В пробной версии вход выключен — в приложении НЭН сначала вход по почте, потом анкета. Здесь Клуб можно посмотреть для примера.'}</p>
    <button class="btn btn-primary" onClick=${join}>Посмотреть бесплатный Клуб</button>
    <button class="btn-quiet" onClick=${closeSheet}>Позже</button>`;
}
export const openJoin = (loggedIn) => { track(loggedIn ? 'мой-нэн:вступить-бесплатно' : 'мой-нэн:войти-и-вступить'); openSheet(JoinSheet, { loggedIn }); };

// Карточка «Клуб НЭН» для тех, кто не в Клубе (экраны 1, 9, 11, 14, 18)
export function ClubInvite({ loggedIn, offline, here }) {
  return html`
    <div class="card mn-promo mn-promo-club">
      <div class="mn-title">Эфиры с врачами и психологами, подарки партнёров, встречи</div>
      <p class="lead">Каждую неделю — эфир с экспертом, записи, канал и чат в Telegram. Вступить можно бесплатно: подарки, карта участника и встречи один на один.</p>
      <p class="small">${offline ? 'Вступить — когда появится сеть.' : loggedIn ? 'Эфиры и записи — в полном Клубе.' : 'Сначала — вход по почте, потом короткая анкета.'}</p>
      <div class="actions">
        <button class=${offline ? 'mn-pale' : ''} disabled=${offline} onClick=${() => openJoin(loggedIn)}>${loggedIn ? 'Вступить бесплатно' : 'Войти и вступить'}</button>
        ${!here && html`<button onClick=${() => { track('мой-нэн:клуб-что-внутри'); go('/moy-nen/klub'); }}>Что внутри</button>`}
      </div>
    </div>`;
}

// Строки бесплатного Клуба: карта, подарки со сроком, встречи (экран 15)
function FreeRows({ offline }) {
  return html`
    <div class="rows">
      <${Row} title="Карта участника" sub="Бесплатный Клуб · карта активна" onClick=${() => openCard('free')} />
      ${offline
        ? html`<${Row} title="Подарки и встречи" sub="Нужна сеть" chev=${false} onClick=${() => {}} />`
        : html`
          <${Row} title="Подарки партнёров" sub=${`Промокоды и скидки — ближайший срок ${dateLong(endOfMonth(now()))}`} onClick=${() => trial('подарки')} />
          <${Row} title="Встречи один на один" sub="Знакомства с участниками Клуба" onClick=${() => trial('встречи')} />`}
    </div>
    <p class="small">Эфиры, записи, канал и чат — в полном Клубе.</p>`;
}

// Блок Клуба на главном
export function ClubBlock({ acc, offline }) {
  if (acc.club === 'paid') {
    return html`
      <${SecTitle} more="Весь Клуб" onMore=${() => { track('мой-нэн:весь-клуб'); go('/moy-nen/klub'); }}>Клуб НЭН<//>
      <${EfirCard} offline=${offline} />
      <div class="rows">
        ${offline
          ? html`
            <${Row} title="Карта участника" sub="Платный Клуб · номер в телефоне" onClick=${() => openCard('paid')} />
            <div class="mn-pale"><${Row} title="Канал и чат в Telegram" sub="Нужна сеть" onClick=${() => {}} /></div>`
          : html`
            <${Row} title="Канал и чат в Telegram" sub="Сообщество Клуба" onClick=${() => trial('telegram')} />
            <${Row} title="Карта участника" sub="Платный Клуб · карта активна" onClick=${() => openCard('paid')} />`}
      </div>`;
  }
  if (acc.club === 'free') {
    return html`
      <${SecTitle} more="Весь Клуб" onMore=${() => { track('мой-нэн:весь-клуб'); go('/moy-nen/klub'); }}>Клуб НЭН<//>
      <${FreeRows} offline=${offline} />`;
  }
  return html`<${SecTitle}>Клуб НЭН<//><${ClubInvite} loggedIn=${acc.loggedIn} offline=${offline} />`;
}

// ——— Экран 6. Клуб НЭН ———
function Club({ query }) {
  const s = useStore();
  const acc = access(s, query);
  const offline = useOffline(s, query);
  if (acc.club === 'paid') {
    return html`
      <div class="screen">
        <${Inner} title="Клуб НЭН" />
        <${SecTitle}>Ближайший эфир<//>
        <${EfirCard} big offline=${offline} />
        <${SecTitle} more=${offline ? null : 'Все'} onMore=${() => trial('все-записи')}>Записи эфиров<//>
        <div class="rows">
          ${offline
            ? html`<div class="mn-pale"><${Row} title="Записи эфиров" sub="Нужна сеть" onClick=${() => {}} /></div>`
            : RECORDS.map((r) => html`<${Row} title=${r.title} sub=${r.sub} onClick=${() => trial('запись')} />`)}
        </div>
        <${SecTitle}>В Клубе<//>
        <div class="rows">
          <${Row} title="Карта участника" sub=${offline ? 'Номер в телефоне' : 'Номер для партнёров'} onClick=${() => openCard('paid')} />
          ${offline
            ? html`<div class="mn-pale"><${Row} title="Telegram, подарки и встречи" sub="Нужна сеть" onClick=${() => {}} /></div>`
            : html`
              <${Row} title="Канал и чат в Telegram" sub="Сообщество Клуба по темам и возрастам" onClick=${() => trial('telegram')} />
              <${Row} title="Подарки партнёров" sub="Промокоды и скидки для участников" onClick=${() => trial('подарки')} />
              <${Row} title="Встречи один на один" sub="Знакомства с участниками Клуба" onClick=${() => trial('встречи')} />
              <${Row} title="Общий вопрос экспертам" sub="Команда Клуба подберёт эксперта" onClick=${() => trial('общий-вопрос')} />`}
        </div>
        <p class="tiny">Пробная версия: Клуб показан для примера — эфиры, напоминания и вопросы никуда не уходят.</p>
      </div>`;
  }
  if (acc.club === 'free') {
    return html`
      <div class="screen">
        <${Inner} title="Клуб НЭН" />
        <${SecTitle}>Ваш Клуб<//>
        <${FreeRows} offline=${offline} />
        <div class="card">
          <div class="mn-eyebrow">Полный Клуб</div>
          <div class="mn-title">Эфиры каждую неделю, записи, канал и чат</div>
          <p class="lead">Эфиры с врачами и психологами, записи прошлых эфиров, канал и чат в Telegram, все рецепты «Семейной кухни».</p>
        </div>
        <p class="tiny">Пробная версия: Клуб показан для примера.</p>
        <button class="btn-quiet" onClick=${() => { setMN((x) => { x.freeClub = false; }); track('мой-нэн:клуб-убрать-пример'); go('/moy-nen', { replace: true }); }}>Убрать пример Клуба</button>
      </div>`;
  }
  return html`
    <div class="screen">
      <${Inner} title="Клуб НЭН" />
      <${ClubInvite} loggedIn=${acc.loggedIn} offline=${offline} here />
      <${SecTitle}>Что внутри<//>
      <div class="rows mn-static">
        <${Row} chev=${false} title="Эфиры каждую неделю" sub="С врачами и психологами; вопрос можно задать заранее и анонимно" />
        <${Row} chev=${false} title="Записи эфиров" sub="Если не успели к началу" />
        <${Row} chev=${false} title="Канал и чат в Telegram" sub="Сообщество Клуба по темам и возрастам" />
        <${Row} chev=${false} title="Карта участника и подарки партнёров" sub="Промокоды и скидки — в бесплатном Клубе тоже" />
        <${Row} chev=${false} title="Встречи один на один" sub="Знакомства с участниками Клуба — в бесплатном Клубе тоже" />
      </div>
    </div>`;
}

export const klubRoutes = [{ path: '/moy-nen/klub', view: Club }];
