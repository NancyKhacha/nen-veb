// «Семья»: вести дневник вместе — второй родитель, бабушка или дедушка, няня (журнал, 5 ноября).
// Как в приложении (app/src/family): приглашение кодом из 8 символов или ссылкой, у каждого свой вход
// по почте, родитель подтверждает участника и может закрыть доступ. Медкарта бабушке — только если откроют.
// В веб-версии записи живут на одном телефоне, поэтому приглашение показывает путь, но дневники не связывает.
import { html, useState } from './lib.js?v=24';
import { useStore, update, activeChild, now } from './store.js?v=24';
import { Back, Row, SecTitle, Field, openSheet, closeSheet, toast } from './ui.js?v=24';
import { go } from './router.js?v=24';
import { track } from './stats.js?v=24';
import { genitive } from './onboarding.js?v=24';

export const ROLES = {
  parent: { who: 'второго родителя', title: 'Второй родитель', sub: 'Видит и записывает всё, как вы' },
  grandparent: { who: 'бабушку или дедушку', title: 'Бабушка или дедушка', sub: 'Дневник, рост и моменты. Медкарту — если откроете' },
  nanny: { who: 'няню', title: 'Няня', sub: 'Только дневник: сон, кормления, подгузники, прогулки' },
};
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 8 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('').replace(/^(.{4})/, '$1-');
const fam = (s) => s.family || { invites: [] };
const childWho = (s) => { const c = activeChild(s); return c && c.name && !c.expecting ? genitive(c.name) : 'ребёнка'; };

function invite(role) {
  const inv = { id: 'i' + now(), role, code: newCode(), at: now() };
  update((d) => { d.family = d.family || { invites: [] }; d.family.invites = [inv, ...(d.family.invites || [])]; });
  track('семья:приглашение-' + role);
  openSheet(InviteSheet, { id: inv.id });
}

function InviteSheet({ id }) {
  const s = useStore();
  const inv = fam(s).invites.find((x) => x.id === id);
  if (!inv) return html`<div class="h2">Приглашение отменили</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const link = `${location.origin}${location.pathname}#/semya/kod?c=${inv.code}`;
  const text = `Давай вести дневник ${childWho(s)} вместе в приложении НЭН. Код приглашения: ${inv.code}`;
  const share = async () => {
    track('семья:отправить');
    try {
      if (navigator.share) await navigator.share({ title: 'Дневник в НЭН', text, url: link });
      else { await navigator.clipboard.writeText(text + '\n' + link); toast({ text: 'Скопировали приглашение — вставьте его в мессенджер', ms: 3000 }); }
    } catch (e) { /* человек закрыл окно «Поделиться» */ }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(inv.code); toast({ text: 'Код скопирован', ms: 2000 }); } catch (e) { toast({ text: `Код: ${inv.code}`, ms: 4000 }); } };
  return html`
    <div class="h2">Позвать ${ROLES[inv.role].who}</div>
    <p class="small">Отправьте ссылку или продиктуйте код. По ссылке откроется НЭН: вход по почте и код. Потом вы подтвердите — и дневник ${childWho(s)} будет у вас обоих.</p>
    <div class="fam-code" aria-label="Код приглашения">${inv.code}</div>
    <button class="btn btn-primary" onClick=${share}>Отправить ссылку</button>
    <button class="btn btn-gray" onClick=${copy}>Скопировать код</button>
    <p class="note-box">Это пробная версия: записи хранятся только на этом телефоне, поэтому у второго человека дневник пока не откроется. Проверяем, понятно ли, как позвать.</p>
    <button class="btn-quiet" onClick=${() => { update((d) => { d.family.invites = d.family.invites.filter((x) => x.id !== id); }); closeSheet(); track('семья:отменить'); toast({ text: 'Приглашение отменили', ms: 2000 }); }}>Отменить приглашение</button>`;
}

// Экран «Семья» — из профиля, из листа ребёнка в шапке и с дашборда «Ребёнка»
function Family() {
  const s = useStore();
  const f = fam(s);
  return html`
    <div class="screen">
      <${Back} title="Семья" />
      <p class="lead">Дневник можно вести вместе. Второй родитель, бабушка или няня записывают со своих телефонов — и всем видно одно и то же: кто когда ел, спал и сколько было подгузников.</p>
      <${SecTitle}>Ведут дневник ${childWho(s)}<//>
      <div class="rows">
        <${Row} title="Вы" sub="Родитель: всё видите, приглашаете и закрываете доступ" />
        ${f.invites.map((x) => html`<${Row} key=${x.id} title=${ROLES[x.role].title} sub=${`Ждём, когда примет приглашение · код ${x.code}`} onClick=${() => openSheet(InviteSheet, { id: x.id })} />`)}
      </div>
      <${SecTitle}>Позвать<//>
      <div class="rows">
        ${Object.entries(ROLES).map(([k, r]) => html`<${Row} key=${k} title=${r.title} sub=${r.sub} onClick=${() => invite(k)} />`)}
      </div>
      <div class="rows">
        <${Row} title="Меня пригласили" sub="Ввести код, который прислали" onClick=${() => { track('семья:у-меня-код'); go('/semya/kod'); }} />
      </div>
      <${SecTitle}>Что общее, а что только ваше<//>
      <div class="rows">
        <${Row} title="Общее" sub="Дневник: сон, кормления, подгузники, дела; здоровье, рост, развитие, моменты" />
        <${Row} title="Только ваше" sub="«Для себя»: заметки, «Как вы?», практики — их никто не видит" />
      </div>
      <p class="small">У каждого — свой вход по почте. Доступ можно закрыть в любой момент: записи у вас останутся.</p>
    </div>`;
}

// Принять приглашение: по ссылке код уже подставлен
function AcceptCode({ query }) {
  const s = useStore();
  const [code, setCode] = useState(((query && query.c) || '').toUpperCase());
  const ok = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code.trim());
  return html`
    <div class="screen">
      <${Back} title="Приглашение в семью" />
      <p class="lead">Код из 8 символов — его присылает тот, кто уже ведёт дневник.</p>
      <${Field} label="Код приглашения" value=${code} placeholder="Например, K7Q4-2MX9" onInput=${(v) => setCode(v.toUpperCase())} />
      <button class="btn btn-primary" disabled=${!ok} onClick=${() => { track('семья:принять'); toast({ text: 'В приложении НЭН здесь — вход по почте, и после подтверждения откроется общий дневник. В пробной версии дневники на разных телефонах не связаны.', ms: 6000 }); }}>Принять приглашение</button>
      <p class="small">Свой дневник на этом телефоне останется как есть.</p>
    </div>`;
}

// Подсказка на дашборде «Ребёнка»: пока никого не позвали
export function FamilyNudge({ s }) {
  const f = fam(s);
  if (f.nudgeOff || f.invites.length) return null;
  return html`
    <div class="card fam-nudge">
      <div class="mn-title">Вести дневник вдвоём</div>
      <p class="small">Позовите второго родителя — записи будут у обоих, и не придётся пересказывать, кто когда ел и спал.</p>
      <div class="actions">
        <button onClick=${() => { track('семья:подсказка'); go('/profil/semya'); }}>Позвать</button>
        <button class="sg-dismiss" onClick=${() => { track('семья:подсказка-скрыть'); update((d) => { d.family = d.family || { invites: [] }; d.family.nudgeOff = true; }); }}>Не сейчас</button>
      </div>
    </div>`;
}

export const semyaRoutes = [
  { path: '/profil/semya', view: Family },
  { path: '/semya/kod', view: AcceptCode },
];
export const familyLine = (s) => { const n = fam(s).invites.length; return n ? `Приглашений: ${n} · ждём ответа` : 'Позвать второго родителя, бабушку или няню'; };
