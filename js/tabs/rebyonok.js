// Вкладка «Ребёнок» — Фигма, страница «33 · V3 · Ребёнок», бриф docs/razdely/rebyonok.md.
// Дашборд — блок на каждый раздел с фактом о ребёнке; разделы — в папке rebyonok/.
import { activitiesFor } from '../content/activities.js?v=16';
import { TALES, SONGS } from '../content/rebyonok-skazki.js?v=16';
import { SYMPTOMS, SKILLS, POST_BIRTH } from '../content/rebyonok-spravka.js?v=16';
import { activeChild, now } from '../store.js?v=16';
import { ageMonths } from '../age.js?v=16';
import { homeRoutes } from './rebyonok/home.js?v=16';
import { dnevnikRoutes } from './rebyonok/dnevnik.js?v=16';
import { razvitieRoutes } from './rebyonok/razvitie.js?v=16';
import { skazkiRoutes } from './rebyonok/skazki.js?v=16';
import { zdorovyeRoutes } from './rebyonok/zdorovye.js?v=16';
import { rostRoutes } from './rebyonok/rost.js?v=16';
import { momentyRoutes } from './rebyonok/momenty.js?v=16';
import { istoriyaRoutes } from './rebyonok/istoriya.js?v=16';

export const routes = [
  ...homeRoutes, ...dnevnikRoutes, ...razvitieRoutes, ...skazkiRoutes, ...zdorovyeRoutes, ...rostRoutes, ...momentyRoutes, ...istoriyaRoutes,
];

// Что найдёт поиск: разделы, занятия возраста, симптомы, сказки и колыбельные, «Когда начинает», документы
const SECTIONS = [
  ['Дневник', 'Дни ребёнка: что было и что в планах', '/rebyonok/dnevnik', 'календарь неделя план дела записи сон кормление'],
  ['Сон за неделю', 'Сколько спал по дням и ориентир возраста', '/rebyonok/istoriya/son', 'сон норма ориентир история'],
  ['Кормления', 'Сколько раз за день, грудь и бутылочка, по дням', '/rebyonok/istoriya/kormleniya', 'кормление грудь бутылочка смесь история сколько ест'],
  ['Подгузники', 'Сколько за день, мокрые и грязные, по дням', '/rebyonok/istoriya/podguzniki', 'подгузник мокрый грязный стул история'],
  ['Здоровье', 'Прививки, осмотры, медкарта', '/rebyonok/zdorovye', 'медкарта врач поликлиника'],
  ['Календарь прививок', 'Что сделано и что впереди', '/rebyonok/zdorovye/privivki', 'прививки вакцинация акдс бцж гепатит пневмококк корь'],
  ['Болезни и лекарства', 'Температура и лекарства по часам', '/rebyonok/zdorovye/bolezni', 'болеет температура лекарство жаропонижающее'],
  ['Когда к врачу сразу', 'Признаки, с которыми не ждут', '/rebyonok/zdorovye/simptomy', 'симптомы скорая 103 врач'],
  ['Домашняя аптечка', 'Что обычно держат дома', '/rebyonok/zdorovye/aptechka', 'аптечка лекарства термометр'],
  ['Зубы', 'Когда режутся и когда к стоматологу', '/rebyonok/zdorovye/zuby', 'зубы прорезывание стоматолог'],
  ['Выписка для врача', 'Всё важное одним файлом для педиатра', '/rebyonok/zdorovye/vypiska', 'педиатр выписка'],
  ['Рост', 'Вес, рост, голова — график и замеры', '/rebyonok/rost', 'вес рост замер окружность головы'],
  ['Развитие', 'Ориентиры возраста и занятия', '/rebyonok/razvitie', 'развитие навыки ориентиры вехи cdc'],
  ['Заметка для педиатра', 'Что рассказать на осмотре', '/rebyonok/razvitie/zametka', 'педиатр осмотр вопросы'],
  ['Сон, экраны и движение', 'Сколько спать, смотреть экран и двигаться', '/rebyonok/razvitie/son-ekrany', 'сон экраны мультики гаджеты движение'],
  ['Когда поговорить с врачом', 'Нет навыка из списка или вас что-то беспокоит', '/rebyonok/razvitie/k-vrachu', 'задержка развития'],
  ['Частые вопросы о развитии', '«Это задержка?», недоношенные', '/rebyonok/razvitie/voprosy', 'задержка недоношенный исправленный возраст'],
  ['Моменты', 'Фото и слова по месяцам', '/rebyonok/momenty', 'фото альбом воспоминания момент'],
  ['Сказки и звуки', 'Колыбельные, шум, потешки, сказки', '/rebyonok/skazki', 'сказки колыбельные белый шум розовый шум уснуть'],
  ['Ваш голос', 'Запишите колыбельную своим голосом', '/rebyonok/skazki/golos', 'голос запись'],
  ['Документы после рождения', 'Свидетельство, СНИЛС, ОМС, пособия', '/rebyonok/dokumenty', 'документы пособие маткапитал госуслуги'],
];

export function searchItems(state) {
  const items = SECTIONS.map(([title, sub, path, text]) => ({ title, sub: 'Ребёнок · ' + sub, path, text }));
  const child = activeChild(state);
  const m = child && !child.expecting ? Math.max(0, ageMonths(child, now())) : null;
  for (const a of m != null ? activitiesFor(m) : []) items.push({ title: a.title, sub: 'Занятие', path: '/rebyonok/zanyatie/' + a.id, text: a.text });
  for (const x of SYMPTOMS) items.push({ title: x.title, sub: 'Когда к врачу', path: '/rebyonok/zdorovye/simptom/' + x.id, text: 'симптом болеет' });
  for (const x of SONGS) items.push({ title: x.title, sub: x.kind, path: '/rebyonok/skazka/' + x.id, text: x.text });
  for (const x of TALES) items.push({ title: x.title, sub: 'Сказка', path: '/rebyonok/skazka/' + x.id, text: [x.alt, x.author, x.about].filter(Boolean).join(' ') });
  for (const x of SKILLS) items.push({ title: x.h1, sub: 'Когда начинает', path: '/rebyonok/razvitie/kogda/' + x.slug, text: x.chip + ' ' + (x.v || '') });
  for (const x of POST_BIRTH) items.push({ title: x.title, sub: 'Документы после рождения', path: '/rebyonok/dokumenty', text: x.deadline || '' });
  return items;
}
