// Школа НЭН — экраны 2 и 5: «Продолжить» на главном, курс «Первый год с малышом», урок.
// В веб-версии курсы не работают: купленный курс — для примера, по флагу «С курсом» в «Для исследования».
import { html, useState, useEffect } from '../../lib.js';
import { useStore, getState, activeChild, now } from '../../store.js';
import { dateLong, pl } from '../../age.js';
import { Row, SecTitle, Ill, toast } from '../../ui.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import {
  setMN, access, useOffline, Inner, FIRSTYEAR, FIRSTYEAR_URL, PERESTAN, courseFor, passedLessons, passedCount,
  childName, dat, gen, openSite, mn,
} from './util.js';

const lessonTitle = (n) => FIRSTYEAR[n - 1].title;
const nowLabel = (c) => { if (!c) return 'Начало курса'; const d = dat(childName(c)); return d ? `${d} сейчас` : 'Сейчас'; };
function nextLine(course) {
  if (!course.nextAt) return 'Это последний урок курса.';
  const d = dat(childName(course.child));
  return `Следующий — «${lessonTitle(course.lesson + 1)}», встанет первым ${dateLong(course.nextAt)}, когда ${d || 'ребёнку'} исполнится ${pl(course.nextAge, 'месяц', 'месяца', 'месяцев')}.`;
}

// Карточка «Продолжить» на главном (экраны 2, 12, 16, 17)
export function ContinueCard({ s, course, offline }) {
  const passed = passedLessons(s, course);
  const n = course.lesson;
  const done = !!passed[n];
  const a = activeChild(s);
  const who = a && a.id !== course.child.id ? gen(childName(course.child)) : null;
  const preterm = course.child.gestWeeks && course.child.gestWeeks < 37;
  const texts = mn(s).lessonTexts;
  let text = preterm
    ? `Урок по исправленному возрасту ${gen(childName(course.child)) || 'ребёнка'} — как развитие в «Ребёнке».`
    : 'Урок этого месяца из курса «Первый год с малышом»: видео экспертов и текст.';
  if (done) text = `Урок ${n} пройден. ${nextLine(course)}`;
  else if (offline) text = texts ? 'Текст урока в телефоне — читается без сети. Видео — когда появится сеть.' : 'Урок открывается на сайте НЭН — когда появится сеть.';
  const open = () => { track('мой-нэн:продолжить'); go('/moy-nen/kurs/urok/' + n); };
  return html`
    <div class="card">
      <${Ill} keep seed=${'урок' + n} />
      <div class="mn-eyebrow">Школа НЭН · урок ${n} из 12${who ? ' · для ' + who : ''}</div>
      <div class="mn-title">${lessonTitle(n)}</div>
      <p class="lead">${text}</p>
      <div class="actions">
        ${offline && !texts && !done
          ? html`<button class="mn-pale" disabled>Продолжить</button>`
          : html`<button onClick=${open}>${done ? 'Открыть ещё раз' : offline ? 'Читать текст' : 'Продолжить'}</button>`}
        <button onClick=${() => { track('мой-нэн:все-уроки'); go('/moy-nen/kurs'); }}>Все уроки</button>
      </div>
    </div>`;
}

// Строка «Школа НЭН» на главном
export function SchoolRow({ s, acc, course, offline }) {
  if (!course) return null;
  if (course.code === 'firstyear') {
    if (acc.course) {
      const p = passedLessons(s, course);
      return html`<${SecTitle}>Школа НЭН<//><div class="rows"><${Row} title="Первый год с малышом" sub=${`Пройдено ${passedCount(p)} из 12`} onClick=${() => { track('мой-нэн:курс'); go('/moy-nen/kurs'); }} /></div>`;
    }
    const n = course.lesson;
    const d = dat(childName(course.child));
    const sub = offline ? 'Нужна сеть' : `12 уроков: урок на каждый месяц. ${d ? d + ' сейчас' : 'Сейчас'} — ${n === 1 ? 'первый' : n === 2 ? 'второй' : '«' + lessonTitle(n).replace(' ребёнка', '') + '»'}`;
    // Промо Школы — карточкой с иллюстрацией курса: из приложения должны покупать (замечание Марии Даниной)
    return html`<${SecTitle}>Школа НЭН<//>
      <button class=${'card mn-promo' + (offline ? ' mn-pale' : '')} onClick=${() => !offline && openSite(FIRSTYEAR_URL, 'первый-год')}>
        <${Ill} src="https://n-e-n.ru/firstyear/images/tild3961-6463-4962-b232-386563383636__2_1.jpg" />
        <div class="mn-title">Первый год с малышом</div>
        <p class="lead">${sub}</p>
        ${!offline && html`<span class="mn-promo-go">Посмотреть курс ›</span>`}
      </button>`;
  }
  const go2 = () => { if (acc.course) { track('мой-нэн:курс'); go('/moy-nen/kurs'); } else if (!offline) openSite(PERESTAN.url, 'перестань'); };
  if (acc.course) return html`<${SecTitle}>Школа НЭН<//>
    <div class="rows"><${Row} title=${PERESTAN.title} sub=${PERESTAN.sub} onClick=${go2} /></div>`;
  return html`<${SecTitle}>Школа НЭН<//>
    <button class=${'card mn-promo' + (offline ? ' mn-pale' : '')} onClick=${go2}>
      <${Ill} src="https://n-e-n.ru/perestan/images/hero.png" />
      <div class="mn-title">${PERESTAN.title}</div>
      <p class="lead">${offline ? 'Нужна сеть' : PERESTAN.sub}</p>
      ${!offline && html`<span class="mn-promo-go">Посмотреть курс ›</span>`}
    </button>`;
}

// ——— Экран 5. Курс ———
function Course({ query }) {
  const s = useStore();
  const acc = access(s, query);
  const offline = useOffline(s, query);
  const found = courseFor(s);
  const [all, setAll] = useState(false);
  if (found && found.code === 'perestan') return html`<${Perestan} acc=${acc} offline=${offline} />`;
  // ребёнка первого года ещё нет — курс без отметок, с первого урока
  const course = found || { code: 'firstyear', child: null, lesson: 1 };
  if (!found) acc.course = false;
  const n = course.lesson;
  const passed = acc.course ? passedLessons(s, course) : {};
  const texts = mn(s).lessonTexts;
  const shown = all ? FIRSTYEAR : FIRSTYEAR.slice(0, Math.max(5, n + 2));
  const status = (l) => (l.n === n ? nowLabel(course.child) : passed[l.n] ? '✓ Пройден' : acc.course ? 'Ещё не открывали' : '');
  const saveTexts = () => {
    setMN((x) => { x.lessonTexts = !texts; });
    track('мой-нэн:тексты-уроков');
    toast({ text: texts ? 'Тексты уроков убрали с телефона' : 'Тексты 12 уроков сохранены — читаются без сети', ms: 3000 });
  };
  return html`
    <div class="screen">
      <${Inner} title="Первый год с малышом" />
      <${SecTitle}>${acc.course ? `Школа НЭН · пройдено ${passedCount(passed)} из 12` : 'Школа НЭН · 12 уроков, по одному на месяц'}<//>
      <div class="card">
        <${Ill} text="Видео из урока" />
        <div class="mn-eyebrow">${nowLabel(course.child)} · урок ${n}</div>
        <div class="mn-title">${lessonTitle(n)}</div>
        ${acc.course
          ? html`<p class="lead">${passed[n] ? `Урок ${n} пройден. ${nextLine(course)}` : 'Урок этого месяца: видео экспертов и текст.'}</p>
            <div class="actions">
              ${offline && !texts
                ? html`<button class="mn-pale" disabled>Продолжить — когда появится сеть</button>`
                : html`<button onClick=${() => { track('мой-нэн:продолжить'); go('/moy-nen/kurs/urok/' + n); }}>${passed[n] ? 'Открыть ещё раз' : offline ? 'Читать текст' : 'Продолжить'}</button>`}
            </div>`
          : html`<p class="lead">Уроки открываются после покупки курса на сайте НЭН — с видео экспертов и текстом.</p>
            <div class="actions">
              ${offline ? html`<button class="mn-pale" disabled>О курсе — когда появится сеть</button>`
                : html`<button onClick=${() => openSite(FIRSTYEAR_URL, 'первый-год')}>О курсе на сайте</button>`}
            </div>`}
      </div>
      <${SecTitle}>Все уроки<//>
      <div class=${'rows' + (acc.course ? '' : ' mn-static')}>
        ${shown.map((l) => html`<${Row} key=${l.n} title=${`${l.n}. ${l.title}`} sub=${status(l)} chev=${acc.course}
          onClick=${() => { if (acc.course) { track('мой-нэн:урок'); go('/moy-nen/kurs/urok/' + l.n); } }} />`)}
      </div>
      ${!all && shown.length < 12 && html`<button class="btn-quiet mn-left" onClick=${() => setAll(true)}>и ещё ${pl(12 - shown.length, 'урок', 'урока', 'уроков')} — до 11–12 месяца</button>`}
      ${acc.course && html`
        <div class=${'rows' + (offline ? ' mn-pale' : '')}>
          <${Row} title="Тексты уроков без сети" sub=${offline ? (texts ? 'Сохранены — читаются без сети' : 'Нужна сеть') : texts ? 'Сохранены — читаются без сети' : 'Сохранить все 12'}
            onClick=${() => !offline && saveTexts()} />
        </div>
        <p class="tiny">Пробная версия: курс показан для примера — уроков и видео здесь нет.</p>`}
    </div>`;
}

// «Вместо „Перестань немедленно“» — с года до семи
function Perestan({ acc, offline }) {
  return html`
    <div class="screen">
      <${Inner} title=${PERESTAN.title} />
      <p class="lead">${PERESTAN.sub}. Порядок любой: начать можно с того, что сейчас важнее.</p>
      <${SecTitle}>Разборы<//>
      <div class="rows mn-static">
        ${PERESTAN.known.map((t) => html`<${Row} chev=${false} title=${t} />`)}
      </div>
      <p class="small">и ещё семь разборов</p>
      ${offline ? html`<button class="btn btn-gray" disabled>О курсе — когда появится сеть</button>`
        : html`<button class="btn btn-gray" onClick=${() => openSite(PERESTAN.url, 'перестань')}>О курсе на сайте</button>`}
      ${acc.course && html`<p class="tiny">Пробная версия: курс показан для примера — разборов здесь нет.</p>`}
    </div>`;
}

// ——— Урок (для примера): в приложении он открывается на странице сайта ———
function Lesson({ params, query }) {
  const s = useStore();
  const acc = access(s, query);
  const offline = useOffline(s, query);
  const course = courseFor(s);
  const n = Math.max(1, Math.min(12, parseInt(params.n, 10) || 1));
  const passed = course ? passedLessons(s, course) : {};
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    const c = courseFor(getState());
    if (!acc.course || !c || passedLessons(getState(), c)[n] || (offline && !mn(getState()).lessonTexts)) return;
    // как на сайте: урок отмечается пройденным, когда его открыли
    setMN((x) => { x.lessons = { ...passedLessons(getState(), c), [n]: now() }; });
    setMarked(true);
    track('мой-нэн:урок-пройден');
    toast({ text: `Урок ${n} пройден`, actions: [{ label: 'Отменить', onClick: () => setMN((x) => { const l = { ...(x.lessons || {}) }; delete l[n]; x.lessons = l; }) }] });
  }, [n]);
  if (!acc.course) {
    return html`<div class="screen"><${Inner} title=${lessonTitle(n)} eyebrow=${`Первый год с малышом · урок ${n} из 12`} />
      <p class="lead">Уроки открываются после покупки курса на сайте НЭН.</p>
      <button class="btn btn-gray" onClick=${() => go('/moy-nen/kurs')}>Все уроки</button></div>`;
  }
  return html`
    <div class="screen">
      <${Inner} title=${lessonTitle(n)} eyebrow=${`Первый год с малышом · урок ${n} из 12`} />
      <${Ill} big text=${offline ? 'Видео — когда появится сеть' : 'Видео из урока'} />
      <p class="lead">В приложении урок открывается здесь же, на странице сайта НЭН: видео экспертов и текст. В пробной версии уроков нет — это место, где он будет.</p>
      ${(marked || passed[n]) && course && n === course.lesson && html`
        <div class="note-box">✓ Урок ${n} пройден. ${nextLine(course)}</div>`}
      <button class="btn btn-gray" onClick=${() => { track('мой-нэн:все-уроки'); go('/moy-nen/kurs'); }}>Все уроки</button>
    </div>`;
}

export const kursRoutes = [
  { path: '/moy-nen/kurs', view: Course },
  { path: '/moy-nen/kurs/urok/:n', view: Lesson },
];
