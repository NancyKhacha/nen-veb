// «Ребёнок → Здоровье» (экраны 8, 18): прививки и визиты — теми же строками, что «На этой неделе»,
// что было — с отметкой; медкарта строками; болезнь и лекарства; симптомы; аптечка; документы после рождения.
import { html, useState, useEffect } from '../../lib.js?v=23';
import { useStore, getState, update, now, uid } from '../../store.js?v=23';
import { Header, Back, SecTitle, Row, Pill, Field, openSheet, closeSheet, toast } from '../../ui.js?v=23';
import { DAY, startOfDay, dateLong, dateWithWeekday, weekdayShort, dayKey, hhmm, ageMonths, isPreterm, childAgeLine, diffYMD } from '../../age.js?v=23';
import { addRecord, removeRecord, recordsOf } from '../../records.js?v=23';
import { EditSheet } from '../../strip.js?v=23';
import { Stepper } from './rost.js?v=23';
import { go } from '../../router.js?v=23';
import { track } from '../../stats.js?v=23';
import { CHECKUP_PLAN, SYMPTOMS, SYMPTOMS_INTRO, SYMPTOMS_SMALL, KIT, TEETH, POST_BIRTH } from '../../content/rebyonok-spravka.js?v=23';
import { R, rUpdate, forChild, bornChild, nameOf, cap, vaccineGroups, dueVaccineGroups, vaccineSub, openVaccine, lastDoneVaccine,
  illness, endIllness, startIllness, tasksOf, inAge, addTask, setTask, removeTask, timeOf, measures, measureLine, Prose, Blocks, inFirstYear, isOffline , NotBorn } from './util.js?v=23';
import { SHEETS, notYet } from './razvitie.js?v=23';
import { openNewMoment } from './momenty.js?v=23';

// ——— Визиты к врачу: дела kind 'doctor' (как на «Сегодня») ———
const DOCTORS = [['педиатр', 'Осмотр у педиатра'], ['невролог', 'Осмотр у невролога'], ['стоматолог', 'Стоматолог, плановый осмотр'], ['другой', 'Визит к врачу']];
function VisitSheet({ childId, id, preset }) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const task = id ? (s.tasks || []).find((x) => x.id === id) : null;
  const t = now();
  const [title, setTitle] = useState(task ? task.title : preset || 'Осмотр у педиатра');
  const [day, setDay] = useState(task ? startOfDay(task.when) : startOfDay(t) + DAY);
  const [time, setTime] = useState(task && task.time ? hhmm(task.when).padStart(5, '0') : '10:00');
  const [other, setOther] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => startOfDay(t) + i * DAY);
  const save = () => {
    const [h, m] = (time || '0:0').split(':').map(Number);
    const when = day + ((h || 0) * 60 + (m || 0)) * 60000;
    if (task) { setTask(task.id, (x) => { x.title = title.trim(); x.when = when; x.time = !!time; }); closeSheet(); toast({ text: 'Визит перенесли', ms: 2000 }); return; }
    const nid = addTask(child, title.trim(), when, 'doctor', { time: !!time });
    track('здоровье:визит');
    closeSheet();
    toast({ text: `Записали: ${dateLong(when)}${time ? ', ' + time : ''} — напомним накануне`, actions: [{ label: 'Отменить', onClick: () => removeTask(nid) }] });
  };
  return html`
    <div class="h2">${task ? 'Визит' : 'Записались к врачу'}</div>
    <div class="pills">${DOCTORS.map(([k, l]) => html`<${Pill} on=${title === l} onClick=${() => setTitle(l)}>${cap(k)}<//>`)}</div>
    <${Field} label="Как назвать" value=${title} onInput=${setTitle} />
    <div class="label">Когда</div>
    <div class="pills">
      ${days.map((d, i) => html`<${Pill} on=${!other && day === d} onClick=${() => { setOther(false); setDay(d); }}>${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${weekdayShort(d)} ${new Date(d).getDate()}`}<//>`)}
      ${other ? html`<input class="pill" type="date" value=${dayKey(day)} onChange=${(e) => { const [y, mo, dd] = e.target.value.split('-').map(Number); if (y) setDay(new Date(y, mo - 1, dd).getTime()); }} />` : html`<button class="pill" onClick=${() => setOther(true)}>Другой день</button>`}
    </div>
    <div class="label">Во сколько</div>
    <input class="pill rb-time" type="time" value=${time} onChange=${(e) => setTime(e.target.value)} />
    <button class="btn btn-primary" disabled=${!title.trim()} onClick=${save}>Готово</button>
    ${task && html`
      <button class="btn btn-gray" onClick=${() => { setTask(task.id, (x) => { x.done = x.done ? null : now(); }); closeSheet(); toast({ text: task.done ? 'Отметку сняли' : 'Отметили: были', ms: 2000 }); }}>${task.done ? 'Ещё не были' : 'Были'}</button>
      <button class="btn-quiet" onClick=${() => { removeTask(task.id); closeSheet(); toast({ text: 'Визит убрали', ms: 2000 }); }}>Удалить</button>`}`;
}
const openVisit = (child, id, preset) => { track('здоровье:визит-лист'); openSheet(VisitSheet, { childId: child.id, id, preset }); };

// Осмотр по графику для возраста ребёнка (приказ № 211н) — от даты рождения
function planRow(child, t = now()) {
  const m = diffYMD(child.dob, t).months;
  let row = null;
  for (const r of CHECKUP_PLAN) if (r.age <= m) row = r;
  const next = CHECKUP_PLAN.find((r) => r.age > m);
  return { row, next };
}
const checkupAt = (child, age, s = getState()) => forChild(R(s).checkups, child.id)[age] || null;
function CheckupSheet({ childId, age }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const r = CHECKUP_PLAN.find((x) => x.age === age);
  const at = checkupAt(child, age, s);
  const set = (v) => rUpdate((x) => { x.checkups = x.checkups || {}; x.checkups[child.id] = { ...(x.checkups[child.id] || {}), [age]: v }; if (!v) delete x.checkups[child.id][age]; });
  return html`
    <div class="h2">Осмотр ${r.age === 0 ? 'новорождённого' : 'в ' + r.ageText}</div>
    <div class="small">По графику${isPreterm(child) ? ' · по дате рождения' : ''}</div>
    <div class="label">Врачи</div><p class="p">${cap(r.doctors.join(', '))}</p>
    ${r.tests.length ? html`<div class="label">Обследования</div><p class="p">${cap(r.tests.join('; '))}</p>` : ''}
    <button class="btn btn-primary" onClick=${() => { const prev = at; set(at ? null : now()); closeSheet(); track('здоровье:осмотр'); toast({ text: at ? 'Отметку сняли' : `Отметили: были ${dateLong(now())}`, actions: [{ label: 'Отменить', onClick: () => set(prev) }] }); }}>${at ? 'Ещё не были' : 'Были'}</button>
    <button class="btn btn-gray" onClick=${() => { closeSheet(); openVisit(child, null, 'Осмотр у педиатра'); }}>Записались</button>`;
}

function Health({ query }) {
  const s = useStore();
  const child = bornChild(s);
  useEffect(() => { if (query && query.zapis && child) { openVisit(child, null); history.replaceState(null, '', '#/rebyonok/zdorovye'); } }, []);
  if (!child) return html`<${NotBorn} title="Здоровье" text="Прививки, осмотры и медкарта начнутся, когда малыш родится." />`;
  const t = now();
  const today = startOfDay(t);
  const groups = vaccineGroups(child, s);
  let upcoming = [...groups.filter((g) => g.planned), ...dueVaccineGroups(child, s).filter((g) => !g.planned)];
  // Ничего срочного — следующие по календарю
  if (!upcoming.length) { const nx = groups.find((g) => !g.done && g.due > t && !g.ids.includes('flu')); if (nx) upcoming = [nx]; }
  const doneG = groups.filter((g) => g.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 2);
  const visits = tasksOf(child, s).filter((x) => x.kind === 'doctor' || x.kind === 'tests');
  const nextVisits = visits.filter((x) => !x.done && x.when >= today).sort((a, b) => a.when - b.when);
  const pastVisits = visits.filter((x) => x.done || x.when < today).sort((a, b) => b.when - a.when).slice(0, 2);
  const { row, next } = planRow(child, t);
  const ill = illness(child, s, t);
  const teeth = forChild(R(s).teeth, child.id);
  const med = forChild(R(s).med, child.id);
  const medN = ['allergy', 'tests', 'passport'].reduce((a, k) => a + ((med[k] || []).length), 0);
  const ct = forChild(R(s).contacts, child.id);
  const pre = isPreterm(child);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Здоровье</h1>
      ${(med.allergy || []).length > 0
        ? html`<button class="note-box allergy-box" onClick=${() => { track('здоровье:аллергии'); go('/rebyonok/zdorovye/zapisi'); }}><b>Аллергия</b> ${(med.allergy || []).map((x) => x.text).join('; ')} ›</button>`
        : html`<div class="rows"><${Row} title="Аллергии" sub="Ничего не записано — если есть, запишите: пригодится врачу, в саду и в поездке" onClick=${() => { track('здоровье:аллергии'); go('/rebyonok/zdorovye/zapisi'); }} /></div>`}
      ${ill && html`
        <${SecTitle}>Сейчас<//>
        <div class="rows"><${Row} title=${`Болеет с ${dateLong(ill.from)}`} sub=${ill.temp ? `Последняя температура ${ill.temp.data.t} в ${hhmm(ill.temp.start)}` : 'Температура и лекарства — по часам'} onClick=${() => go('/rebyonok/zdorovye/bolezni')} /></div>`}
      <${SecTitle}>Прививки<//>
      <div class="rows">
        ${upcoming.map((g) => html`<${Row} key=${g.key} title=${g.title} sub=${(g.due > t + 7 * DAY && !g.planned ? `Дальше по календарю — ${inAge(g.ageText)}, ${dateLong(g.due)}` : vaccineSub(child, g)) + (pre && !g.planned ? ' · по дате рождения' : '')} onClick=${() => openVaccine(child, g)} />`)}
        ${doneG.map((g) => html`<${Row} key=${g.key} title=${g.title} sub=${vaccineSub(child, g)} onClick=${() => openVaccine(child, g)} />`)}
        <${Row} title="Весь календарь прививок" sub="Что сделано и что впереди" onClick=${() => { track('здоровье:календарь'); go('/rebyonok/zdorovye/privivki'); }} />
      </div>
      <${SecTitle}>Осмотры и визиты<//>
      <div class="rows">
        ${nextVisits.map((x) => html`<${Row} key=${x.id} title=${x.title} sub=${`${dateWithWeekday(x.when)}${x.time ? ', ' + hhmm(x.when) : ''} · напомним накануне`} onClick=${() => openVisit(child, x.id)} />`)}
        ${row && html`<${Row} title=${`Осмотр ${row.age === 0 ? 'новорождённого' : 'в ' + row.ageText}`} sub=${checkupAt(child, row.age, s) ? `Были ${dateLong(checkupAt(child, row.age, s))}` : `По графику: ${row.doctors.join(', ')}`} onClick=${() => openSheet(CheckupSheet, { childId: child.id, age: row.age })} />`}
        ${next && html`<${Row} title=${`Осмотр в ${next.ageText}`} sub=${`Дальше по графику: ${next.doctors.join(', ')}`} onClick=${() => openSheet(CheckupSheet, { childId: child.id, age: next.age })} />`}
        ${pastVisits.map((x) => html`<${Row} key=${x.id} title=${x.title} sub=${x.done ? `Были ${dateLong(x.done)}` : `Было ${dateLong(x.when)} — были?`} onClick=${() => openVisit(child, x.id)} />`)}
        <${Row} title="＋ Записались к врачу" sub="Напомним накануне" onClick=${() => openVisit(child)} />
      </div>
      <${SecTitle}>Медкарта<//>
      <div class="rows">
        <${Row} title="Болезни и лекарства" sub=${ill ? `Болеет с ${dateLong(ill.from)}${ill.med ? ' · ' + ill.med.data.name : ''}` : 'Сейчас ничего не записано'} onClick=${() => { track('здоровье:болезни'); go('/rebyonok/zdorovye/bolezni'); }} />
        <${Row} title="Зубы" sub=${teeth.first ? `Первый зуб — ${dateLong(teeth.first)}` : 'Пока нет'} onClick=${() => { track('здоровье:зубы'); go('/rebyonok/zdorovye/zuby'); }} />
        <${Row} title="Аллергии, анализы, паспорт здоровья" sub=${medN ? `Записано: ${medN}` : 'Ничего не записано'} onClick=${() => { track('здоровье:медкарта'); go('/rebyonok/zdorovye/zapisi'); }} />
        <${Row} title="Домашняя аптечка" sub="Что есть и сроки годности" onClick=${() => { track('здоровье:аптечка'); go('/rebyonok/zdorovye/aptechka'); }} />
        <${Row} title="Когда к врачу сразу" sub="Признаки, с которыми не ждут" onClick=${() => { track('здоровье:симптомы'); go('/rebyonok/zdorovye/simptomy'); }} />
        <${Row} title="Выписка для врача" sub="Всё важное одним файлом для педиатра" onClick=${() => { track('здоровье:выписка'); go('/rebyonok/zdorovye/vypiska'); }} />
        <${Row} title="Врачи и контакты" sub=${ct.clinic || ct.doctor ? [ct.clinic, ct.doctor].filter(Boolean).join(' · ') : 'Поликлиника и педиатр'} onClick=${() => { track('здоровье:контакты'); go('/rebyonok/zdorovye/kontakty'); }} />
        ${!inFirstYear(child) && html`<${Row} title="Документы после рождения" sub=${docsLine(child, s).sub} onClick=${() => go('/rebyonok/dokumenty')} />`}
      </div>
    </div>`;
}

// ——— Весь календарь прививок ———
function Calendar() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Прививки" text="Раздел откроется, когда малыш родится." />`;
  const groups = vaccineGroups(child, s);
  const done = groups.filter((g) => g.done).length;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Календарь прививок</h1>
      <p class="small">Сделано ${done} из ${groups.length}. Сроки — от даты рождения${isPreterm(child) ? ', и у недоношенных тоже' : ''}. Касание — отметить.</p>
      <div class="rows">${groups.map((g) => html`<${Row} key=${g.key} title=${g.title} sub=${g.done || g.planned ? vaccineSub(child, g) : `${cap(g.ageText)} · ${dateLong(g.due)}`} end=${g.done ? '✓' : ''} onClick=${() => openVaccine(child, g)} />`)}</div>
      <p class="tiny">По национальному календарю прививок. Прививки для групп риска и по эпидемическим показаниям назначает врач.</p>
    </div>`;
}

// ——— Болезни и лекарства ———
function TempSheet({ childId }) {
  const [v, setV] = useState(37.5);
  return html`
    <div class="h2">Температура</div>
    <${Stepper} value=${v} step=${0.1} unit="°" digits=${1} onChange=${(x) => setV(x == null ? 36.6 : x)} />
    <button class="btn btn-primary" onClick=${() => { const made = addRecord(childId, 'temp', { t: v.toFixed(1).replace('.', ',') }); closeSheet(); track('болезнь:температура'); toast({ text: `Записано: ${v.toFixed(1).replace('.', ',')}°`, actions: [{ label: 'Отменить', onClick: () => made.forEach(removeRecord) }] }); }}>Записать</button>`;
}
function MedSheet({ childId, name: preset = '' }) {
  const [name, setName] = useState(preset);
  return html`
    <div class="h2">Лекарство</div>
    <${Field} label="Лекарство" value=${name} onInput=${setName} placeholder="Как назвал врач" />
    <button class="btn btn-primary" disabled=${!name.trim()} onClick=${() => { const made = addRecord(childId, 'med', { name: name.trim() }); closeSheet(); track('болезнь:лекарство'); toast({ text: `Записано: ${name.trim()}, ${hhmm(now())}`, actions: [{ label: 'Отменить', onClick: () => made.forEach(removeRecord) }] }); }}>Записать приём</button>`;
}
function Illness() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Болезни и лекарства" text="Раздел откроется, когда малыш родится." />`;
  const ill = illness(child, s);
  const eps = (forChild(R(s).ill, child.id) || []);
  const past = (Array.isArray(eps) ? eps : []).filter((e) => e.to).sort((a, b) => b.from - a.from);
  const meds = ill ? [...new Set(ill.recs.filter((r) => r.type === 'med').map((r) => r.data.name))] : [];
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Болезни и лекарства</h1>
      ${ill ? html`
        <div class="card">
          <div class="h3">Болеет с ${dateLong(ill.from)}</div>
          <div class="small">${ill.temp ? `Последняя температура ${ill.temp.data.t} в ${hhmm(ill.temp.start)}` : 'Температуру ещё не записывали'}${ill.med ? ` · ${ill.med.data.name}: последний приём в ${hhmm(ill.med.start)}` : ''}</div>
          <div class="pills">
            <button class="pill" onClick=${() => openSheet(TempSheet, { childId: child.id })}>＋ Температура</button>
            ${meds.map((n) => html`<button class="pill" onClick=${() => openSheet(MedSheet, { childId: child.id, name: n })}>＋ ${n}</button>`)}
            <button class="pill" onClick=${() => openSheet(MedSheet, { childId: child.id })}>＋ Лекарство</button>
          </div>
        </div>
        <${SecTitle}>По часам<//>
        <div class="rows">${ill.recs.map((r) => html`<${Row} key=${r.id} title=${r.type === 'temp' ? `Температура ${r.data.t}°` : r.data.name} sub=${`${dateLong(r.start)}, ${hhmm(r.start)}`} onClick=${() => openSheet(EditSheet, { id: r.id })} />`)}</div>
        <button class="btn btn-gray" onClick=${() => { const from = ill.from; endIllness(child, from); track('болезнь:закончилась'); toast({ text: 'Болезнь закончилась — выздоравливайте', ms: 3000 }); }}>Закончилась</button>
        <p class="tiny">Приём лекарства по часам — ещё и срочным на «Сегодня». Когда звонить врачу — в «Когда к врачу сразу».</p>`
      : html`
        <p class="lead">Сейчас ничего не записано. Если ребёнок заболел — запишите температуру или лекарство: здесь соберётся болезнь по часам.</p>
        <div class="pills">
          <button class="pill" onClick=${() => { startIllness(child); openSheet(TempSheet, { childId: child.id }); }}>＋ Температура</button>
          <button class="pill" onClick=${() => { startIllness(child); openSheet(MedSheet, { childId: child.id }); }}>＋ Лекарство</button>
        </div>`}
      <div class="rows"><${Row} title="Когда к врачу сразу" sub="Признаки, с которыми не ждут" onClick=${() => go('/rebyonok/zdorovye/simptomy')} /></div>
      ${past.length > 0 && html`<${SecTitle}>Раньше<//><div class="rows">${past.map((e) => html`<${Row} key=${e.id} chev=${false} title=${startOfDay(e.from) === startOfDay(e.to) ? dateLong(e.from) : `${dateLong(e.from)} — ${dateLong(e.to)}`} sub=${(() => { const n = recordsOf(child.id, s).filter((r) => (r.type === 'temp' || r.type === 'med') && r.start >= startOfDay(e.from) && r.start <= e.to).length; return n ? `${n} ${n === 1 ? 'запись' : n < 5 ? 'записи' : 'записей'}` : 'Без записей'; })()} />`)}</div>`}
    </div>`;
}

// ——— Симптомы: «Когда к врачу сразу» ———
function Symptoms() {
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Когда к врачу</h1>
      <p class="p">${SYMPTOMS_INTRO}</p>
      <a class="btn btn-primary" href="tel:103" onClick=${() => track('здоровье:позвонить-103')}>Позвонить 103</a>
      <div class="rows">${SYMPTOMS.map((x) => html`<${Row} key=${x.id} title=${x.title} onClick=${() => { track('здоровье:симптом'); go('/rebyonok/zdorovye/simptom/' + x.id); }} />`)}</div>
      <p class="tiny">${SYMPTOMS_SMALL}</p>
    </div>`;
}
function Symptom({ params }) {
  const s = useStore();
  const child = bornChild(s);
  const c = SYMPTOMS.find((x) => x.id === params.id);
  if (!c) return html`<div class="screen"><${Back} title="Когда к врачу" to="/rebyonok/zdorovye/simptomy" /><p class="empty">Такой карточки нет.</p></div>`;
  const m = child ? diffYMD(child.dob, now()).months : 12;
  const v = c.variants.find((x) => m >= x.fromM && m <= x.toM) || c.variants[0];
  const sec = v.sections;
  return html`
    <div class="screen">
      <${Back} />
      <h1 class="h1">${c.title}</h1>
      ${sec.emergency && html`<div class="rb-alarm"><div class="h3">Звоните 103 сейчас</div><${Prose} text=${sec.emergency} /><a class="btn btn-primary" href="tel:103">Позвонить 103</a></div>`}
      ${sec.doctor && html`<div class="h3">Покажите врачу</div><${Prose} text=${sec.doctor} />`}
      ${sec.home && html`<div class="h3">Что можно сделать дома</div><${Prose} text=${sec.home} />`}
      ${child && html`<button class="btn btn-gray" onClick=${() => { startIllness(child); track('здоровье:записать-болезнь'); go('/rebyonok/zdorovye/bolezni'); }}>Записать болезнь</button>`}
      <p class="tiny">Карточки написала редакция НЭН по клиническим рекомендациям Минздрава России и материалам ВОЗ. Раздел справочный и не заменяет врача.</p>
    </div>`;
}

// ——— Аптечка: подсказка и свой список со сроками ———
function Kit() {
  const s = useStore();
  const [name, setName] = useState('');
  const [till, setTill] = useState('');
  const list = R(s).kit || [];
  const t = now();
  const add = () => { rUpdate((r) => { r.kit = [{ id: uid(), name: name.trim(), till: till || null, at: now() }, ...(r.kit || [])]; }); setName(''); setTill(''); track('аптечка:добавить'); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Домашняя аптечка</h1>
      <${SecTitle}>Что есть у вас<//>
      <div class="rows">${list.map((x) => {
        const exp = x.till && new Date(x.till).getTime() < t;
        return html`<div class="row"><span class="row-text"><span class="row-title">${x.name}</span><span class="row-sub">${x.till ? (exp ? 'Срок годности вышел' : 'Годен до ' + dateLong(new Date(x.till).getTime())) : 'Срок не записан'}</span></span><button class="row-end" onClick=${() => rUpdate((r) => { r.kit = r.kit.filter((y) => y.id !== x.id); })}>Убрать</button></div>`;
      })}</div>
      <${Field} label="Что есть" value=${name} onInput=${setName} placeholder="Термометр, солевой раствор…" />
      <label class="field"><span class="label">Годен до — если есть на упаковке</span><input type="date" value=${till} onChange=${(e) => setTill(e.target.value)} /></label>
      <button class="btn btn-gray" disabled=${!name.trim()} onClick=${add}>Добавить</button>
      <${SecTitle}>Что обычно держат дома<//>
      <${Blocks} list=${KIT.filter((b) => b.h !== 'Что обычно держат дома')} />
    </div>`;
}

// ——— Зубы ———
function Teeth() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Зубы" text="Раздел откроется, когда малыш родится." />`;
  const z = forChild(R(s).teeth, child.id);
  const set = (v) => rUpdate((r) => { r.teeth = r.teeth || {}; r.teeth[child.id] = { ...(r.teeth[child.id] || {}), first: v }; });
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Зубы</h1>
      <div class="card-gray">
        <div class="h3">${z.first ? `Первый зуб — ${dateLong(z.first)}` : 'Первого зуба пока нет'}</div>
        <div class="pills">${z.first ? html`<button class="pill" onClick=${() => set(null)}>Снять отметку</button>`
          : html`<button class="pill" onClick=${() => { set(now()); track('зубы:первый'); toast({ text: 'Первый зуб. Сохраните момент: дата уже записана, можно добавить фото.', actions: [{ label: 'Момент', onClick: () => openNewMoment(child, { text: 'Первый зуб' }) }] }); }}>Появился первый зуб</button>`}</div>
      </div>
      <${Blocks} list=${TEETH} />
    </div>`;
}

// ——— Аллергии, анализы, паспорт здоровья ———
const MED = [['allergy', 'Аллергии', 'На что и как проявилась'], ['tests', 'Анализы', 'Что сдавали и когда'], ['passport', 'Паспорт здоровья', 'Группа крови, хронические болезни, особенности']];
function MedRecords() {
  const s = useStore();
  const child = bornChild(s);
  const [kind, setKind] = useState('allergy');
  const [text, setText] = useState('');
  if (!child) return html`<${NotBorn} title="Медкарта" text="Раздел откроется, когда малыш родится." />`;
  const med = forChild(R(s).med, child.id);
  const add = () => { rUpdate((r) => { r.med = r.med || {}; const m = r.med[child.id] = r.med[child.id] || {}; m[kind] = [{ id: uid(), text: text.trim(), at: now() }, ...(m[kind] || [])]; }); setText(''); track('медкарта:добавить'); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Аллергии, анализы, паспорт здоровья</h1>
      ${MED.map(([k, title]) => html`
        <${SecTitle}>${title}<//>
        ${(med[k] || []).length ? html`<div class="rows">${med[k].map((x) => html`<div class="row"><span class="row-text"><span class="row-title">${x.text}</span><span class="row-sub">${dateLong(x.at)}</span></span><button class="row-end" onClick=${() => rUpdate((r) => { r.med[child.id][k] = r.med[child.id][k].filter((y) => y.id !== x.id); })}>Убрать</button></div>`)}</div>` : html`<p class="small">Ничего не записано</p>`}`)}
      <div class="pills">${MED.map(([k, title]) => html`<${Pill} on=${kind === k} onClick=${() => setKind(k)}>${title}<//>`)}</div>
      <label class="field"><span class="label">${MED.find((x) => x[0] === kind)[2]}</span><textarea value=${text} onInput=${(e) => setText(e.target.value)}></textarea></label>
      <button class="btn btn-gray" disabled=${!text.trim()} onClick=${add}>Записать</button>
      <p class="tiny">Медкарта хранится только на этом телефоне.</p>
    </div>`;
}

// ——— Врачи и контакты ———
function Contacts() {
  const s = useStore();
  const child = bornChild(s);
  const c0 = child ? forChild(R(s).contacts, child.id) : {};
  const [clinic, setClinic] = useState(c0.clinic || '');
  const [doctor, setDoctor] = useState(c0.doctor || '');
  const [phone, setPhone] = useState(c0.phone || '');
  if (!child) return html`<${NotBorn} title="Врачи и контакты" text="Раздел откроется, когда малыш родится." />`;
  const save = () => { rUpdate((r) => { r.contacts = r.contacts || {}; r.contacts[child.id] = { clinic: clinic.trim(), doctor: doctor.trim(), phone: phone.trim() }; }); track('здоровье:контакты-сохранить'); toast({ text: 'Сохранили', ms: 2000 }); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Врачи и контакты</h1>
      <${Field} label="Поликлиника" value=${clinic} onInput=${setClinic} placeholder="Детская поликлиника № 1" />
      <${Field} label="Педиатр" value=${doctor} onInput=${setDoctor} placeholder="Имя и отчество" />
      <${Field} label="Телефон" type="tel" value=${phone} onInput=${setPhone} placeholder="Регистратура или вызов врача на дом" />
      <button class="btn btn-primary" onClick=${save}>Сохранить</button>
      ${c0.phone && html`<a class="btn btn-gray" href=${'tel:' + c0.phone.replace(/[^\d+]/g, '')}>Позвонить в поликлинику</a>`}
      <div class="note-box">Скорая — 103, единый номер экстренных служб — 112.</div>
    </div>`;
}

// ——— Выписка для врача ———
function Extract() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Выписка для врача" text="Раздел откроется, когда малыш родится." />`;
  const t = now();
  const ms = measures(child, s);
  const done = vaccineGroups(child, s).filter((g) => g.done);
  const ill = illness(child, s, t);
  const med = forChild(R(s).med, child.id);
  const no = SHEETS.flatMap((x) => x.items).filter((it) => notYet(child, it.id, s));
  const lines = [
    `${nameOf(child)}, ${dateLong(child.dob)} ${new Date(child.dob).getFullYear()} г. р. Возраст: ${childAgeLine(child, t)}.`,
    child.gestWeeks ? `Родился на ${child.gestWeeks}-й неделе.` : null,
    '',
    'Замеры:', ...(ms.length ? ms.slice(0, 5).map((r) => `— ${dateLong(r.start)}: ${measureLine(r)}`) : ['— не записаны']),
    '',
    'Прививки:', ...(done.length ? done.map((g) => `— ${g.title}: ${dateLong(g.doneAt)}`) : ['— не отмечены']),
    '',
    ...(ill ? [`Сейчас болеет с ${dateLong(ill.from)}.`, ...ill.recs.slice(0, 10).map((r) => `— ${dateLong(r.start)}, ${hhmm(r.start)}: ${r.type === 'temp' ? 'температура ' + r.data.t : r.data.name}`), ''] : []),
    ...['allergy', 'tests', 'passport'].flatMap((k) => (med[k] || []).length ? [{ allergy: 'Аллергии:', tests: 'Анализы:', passport: 'Паспорт здоровья:' }[k], ...med[k].map((x) => '— ' + x.text), ''] : []),
    ...(no.length ? ['Развитие — пока не делает или не уверены:', ...no.map((x) => '— ' + x.ru), ''] : []),
  ].filter((x) => x != null);
  const text = lines.join('\n');
  const share = () => { track('здоровье:выписка-поделиться'); if (navigator.share) navigator.share({ title: 'Выписка для врача', text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast({ text: 'Скопировали — можно вставить в сообщение врачу', ms: 2500 })); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Выписка для врача</h1>
      <p class="small">Собрано из того, что записано на этом телефоне. Проверьте перед отправкой.</p>
      <pre class="rb-extract">${text}</pre>
      <button class="btn btn-primary" onClick=${share}>Поделиться</button>
    </div>`;
}

// ——— Документы после рождения ———
const docDone = (child, id, s = getState()) => forChild(R(s).docs, child.id)[id] || null;
export function docsLine(child, s = getState()) {
  const n = POST_BIRTH.filter((d) => docDone(child, d.id, s)).length;
  const next = POST_BIRTH.find((d) => !docDone(child, d.id, s));
  if (!n && next && next.id === 'birth-certificate') {
    const till = new Date(child.dob); till.setMonth(till.getMonth() + 1);
    return { title: next.title, sub: till.getTime() > now() ? `До ${dateLong(till.getTime())} — Госуслуги, ЗАГС или МФЦ` : 'Госуслуги, ЗАГС или МФЦ — отметьте, если уже оформили' };
  }
  const word = n === 1 ? 'дело' : n < 5 && n > 1 ? 'дела' : 'дел';
  return { title: `Готово ${n} ${word} из ${POST_BIRTH.length}`, sub: next ? `Дальше — ${next.title[0].toLowerCase() + next.title.slice(1)}` : 'Всё оформлено', n };
}
function DocSheet({ childId, id }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const d = POST_BIRTH.find((x) => x.id === id);
  const at = docDone(child, id, s);
  const offline = isOffline(s);
  const set = (v) => rUpdate((r) => { r.docs = r.docs || {}; r.docs[child.id] = { ...(r.docs[child.id] || {}) }; if (v) r.docs[child.id][id] = v; else delete r.docs[child.id][id]; });
  return html`
    <div class="h2">${d.title}</div>
    ${d.deadline && html`<div class="label">Когда</div><p class="p">${d.deadline}</p>`}
    ${d.where && html`<div class="label">Где оформить</div><p class="p">${d.where}</p>`}
    ${d.documents && html`<div class="label">Что взять</div><p class="p">${d.documents}</p>`}
    ${d.amount && html`<div class="label">Сколько</div><p class="p">${d.amount}</p>`}
    <div class="stack">${(d.links || []).slice(0, 2).map((l) => html`<a class="link" href=${l.url} target="_blank" rel="noopener" onClick=${() => track('документы:ссылка')}>${offline ? 'Нужна сеть · ' : ''}${l.title} ›</a>`)}
      <a class="link" href="https://www.gosuslugi.ru/situation/birth_child" target="_blank" rel="noopener">На Госуслуги ›</a></div>
    <div class="pills">
      <${Pill} on=${!!at} onClick=${() => { set(now()); track('документы:сделали'); }}>Сделали<//>
      <${Pill} on=${!at} onClick=${() => set(null)}>Ещё нет<//>
    </div>
    <button class="btn btn-primary" onClick=${() => { closeSheet(); if (docDone(child, id)) toast({ text: `Готово: ${d.title}`, actions: [{ label: 'Отменить', onClick: () => set(null) }] }); }}>Готово</button>`;
}
function Documents() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Документы после рождения" text="Раздел откроется, когда малыш родится." />`;
  const ready = POST_BIRTH.filter((d) => docDone(child, d.id, s));
  const next = POST_BIRTH.filter((d) => !docDone(child, d.id, s));
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Документы после рождения</h1>
      <p class="small">Положено ли пособие вашей семье и в каком размере, решает Социальный фонд. Суммы обновляются каждый год с 1 февраля.</p>
      ${next.length > 0 && html`<${SecTitle}>Дальше<//><div class="rows">${next.map((d) => html`<${Row} key=${d.id} title=${d.title} sub=${d.id === 'birth-certificate' ? docsLine(child, s).sub : (d.deadline || '').split('. ')[0]} onClick=${() => openSheet(DocSheet, { childId: child.id, id: d.id })} />`)}</div>`}
      ${ready.length > 0 && html`<${SecTitle}>Готово · ${ready.length} из ${POST_BIRTH.length}<//><div class="rows">${ready.map((d) => html`<${Row} key=${d.id} title=${d.title} sub=${`Сделали ${dateLong(docDone(child, d.id, s))}`} onClick=${() => openSheet(DocSheet, { childId: child.id, id: d.id })} />`)}</div>`}
    </div>`;
}

export const zdorovyeRoutes = [
  { path: '/rebyonok/zdorovye', view: Health, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/privivki', view: Calendar, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/bolezni', view: Illness, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/simptomy', view: Symptoms, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/simptom/:id', view: Symptom, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/aptechka', view: Kit, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/zuby', view: Teeth, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/zapisi', view: MedRecords, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/kontakty', view: Contacts, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zdorovye/vypiska', view: Extract, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/dokumenty', view: Documents, tab: '/rebyonok', strip: true },
];
