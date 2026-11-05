// «Для себя»: подборки статей НЭН, тесты с сайта и тексты «Если тяжело».
// Подборки — темы статей НЭН (бриф docs/razdely/dlya-sebya.md, «Подборки»). Статьи — из архива n-e-n.ru:
// часть уже есть в articles.js (общая читалка /statya/:id), остальные — в dlya-sebya-stati.js.
// t и s у статьи — короткая строка, как в Фигме (страница «34 · V3 · Для себя», экран 4).
import { articleById } from './articles.js?v=16';
import { statyaById } from './dlya-sebya-stati.js?v=16';

export const PODBORKI = [
  {
    id: 'telo-posle-rodov',
    title: 'Тело после родов',
    sub: 'Диастаз, тазовое дно, волосы — и без «вернуться в форму»',
    items: [
      { id: 'diastasis' },
      { id: 'birthinjury', t: '«Через ваше тазовое дно проехал грузовик»', s: 'Почему не стоит терпеть недержание и боль после родов' },
      { id: 'dontbeahero', t: 'Не спешите быть Чудо-женщиной', s: '6 ошибок, которых стоит избегать после родов' },
      { id: 'bodylove', t: 'Снова подружиться со своим телом', s: '5 способов после родов' },
      { id: 'alopecija-posle-rodov', t: 'Почему выпадают волосы после родов?' },
    ],
    // Эфир Клуба — показательный, только в режиме «В Клубе» (название эфира в Фигме — пример)
    efir: { title: 'Тазовое дно после родов: вопросы физиотерапевту', sub: 'Запись эфира · для Клуба' },
    practice: 'opustit-plechi',
  },
  {
    id: 'ustalost-i-vygoranie',
    title: 'Усталость и выгорание',
    sub: 'Когда сил нет и кажется, что так будет всегда',
    items: [
      { id: 'eto-kakaa-to-pustota-vnutri-ni-zalosti-ni-zlosti-ni-lubvi-cto-takoe-emocional-noe-vygoranie-zensiny-v-dekrete' },
      { id: 'kak-byt-roditeliu-v-depressii', t: 'Нет сил заботиться', s: 'Как выжить родителю, которого накрыла депрессия' },
      { id: 'materinskoe-vygoranie-podkradyvaetsa-nezametno', t: '«Материнское выгорание подкрадывается незаметно»' },
      { id: 'materinstvo-v-tri-chasa-nochi', t: 'Материнство в три часа ночи', s: 'О чём мы молчим, когда мир спит' },
      { id: 'sleeplessnight', t: 'Как выжить после бессонной ночи с младенцем' },
      { id: 'psiholog-o-tom-kak-izbezhat-roditelskogo-vygorania', t: 'Без отпусков и больничных', s: 'Как избежать родительского выгорания' },
      { id: 'burnouthacks', t: '7 способов справиться с выгоранием', s: 'По версии работающей мамы двух тоддлеров' },
      { id: 'depmatern', t: 'Приуныли в декрете?', s: 'Это называется «депрессия домохозяек», и вы в ней не одиноки' },
      { id: 'burnout', t: 'Откуда берётся родительское выгорание', s: 'И чем оно опасно' },
    ],
    practice: 'tri-minuty-na-kuhne',
  },
  {
    id: 'para',
    title: 'Пара',
    sub: 'Что происходит с отношениями, когда появляется ребёнок',
    items: [
      { id: 'betogether', t: 'Как сохранить отношения после рождения ребёнка', s: '«Я хотела избить его прикроватной лампой»' },
      { id: 'changerelationship', t: 'После появления ребёнка отношения изменятся', s: 'И вот почему' },
      { id: 'burnedpartner', t: 'Что делать, если партнёр на нуле', s: '«Выгорание — это не событие, это процесс»' },
      { id: 'postelniy-razvod' },
      { id: '10-opasnyh-mifov-o-scastlivom-brake', t: '10 опасных мифов о счастливом браке', s: 'Никаких ссор и общие интересы' },
    ],
    test: 'abjuz-test',
    practice: 'dyhanie-4-6',
  },
  {
    id: 'rabota-i-dekret',
    title: 'Работа и декрет',
    sub: 'Выйти на работу, остаться дома — и не оправдываться',
    items: [
      { id: 'employment-gaps', t: '«А почему в резюме такой большой пропуск?»', s: 'Как женщинам приходится оправдываться за годы в декрете' },
      { id: 'aneesa', t: '«Нет, я не просто мама, которая сидит дома»', s: 'О карьере, материнстве, ожиданиях и реальности' },
      { id: 'jobvsstayhome', t: 'Не осуждать за выбор между карьерой и декретом', s: 'Отцов за это не осуждают — так давайте не будем и матерей' },
      { id: 'bolnichnyj', t: '«Полощут за спиной и грозят уволить»', s: 'Монологи работающих мам' },
      { id: 'care', t: 'Право на материнство', s: 'Почему успешная карьера заставляет нас стесняться своих детей' },
    ],
    practice: 'opustit-plechi',
  },
  {
    id: 'dengi',
    title: 'Деньги',
    sub: 'Декретные, подушка, общий бюджет — и свои деньги',
    items: [
      { id: 'kak-perestat-tratit-vse-do-kopejki-i-nacat-otkladyvat', t: 'Как перестать тратить всё до копейки', s: 'И начать откладывать: рассказывает финансовый консультант' },
      { id: 'givememymoney', t: 'Как считаются и выплачиваются «декретные»', s: 'И почему работодатель здесь ни при чём (почти)' },
      { id: 'ne-prosit-u-muzha', t: 'Не просить у мужа деньги на прокладки', s: 'Как договориться о семейном бюджете в декрете' },
      { id: 'kak-sozdat-fin-podushky', t: 'Как создать финансовую подушку', s: 'Советы, инструменты и опыт читателей' },
      { id: 'bespoleznye-tovary', t: 'Потратьте декретные на что-нибудь другое', s: 'Бесполезные, но навязываемые товары для детей и родителей' },
      { id: 'finansovoje-nasilije', t: 'Что такое финансовое насилие', s: '«Ты не умеешь обходиться с деньгами, пусть они лучше будут у меня»' },
    ],
    test: 'dengi-test',
    practice: 'dyhanie-4-6',
  },
  {
    id: 'svoyo-vremya',
    title: 'Своё время',
    sub: 'Забота о себе — с малого, а не со спа',
    items: [
      { id: 'selfcareisnotspaha', t: 'Забота о себе — это не маникюр и спа', s: 'Возмущённая колонка и список способов поддержать себя' },
      { id: 'everydaycare', t: '«Одна вылазка в бар не перекрывает месяцы недосыпа»', s: 'Почему забота о себе должна стать повседневностью' },
      { id: 'takecare', t: 'Забота о себе начинается с малого', s: 'Например, с горячего душа' },
      { id: 'svidanie-s-soboy-ili-zachem-mame-idti-v-kino-odnoy', t: 'Свидание с собой', s: 'Зачем маме идти в кино одной' },
      { id: 'filmy-o-materinstve', t: '10 лучших фильмов о материнстве' },
    ],
    practice: 'blagodarnost-sebe',
  },
];
export const podborkaById = (id) => PODBORKI.find((p) => p.id === id);

// Порядок лент: в первый год — «Тело после родов» первой, потом она уходит в «Все ›» (экраны 1 и 9)
export const ORDER_FIRST_YEAR = ['telo-posle-rodov', 'ustalost-i-vygoranie', 'para', 'rabota-i-dekret', 'dengi', 'svoyo-vremya'];
export const ORDER_LATER = ['rabota-i-dekret', 'para', 'dengi', 'ustalost-i-vygoranie', 'svoyo-vremya', 'telo-posle-rodov'];
export const ORDER_NO_CHILD = ['ustalost-i-vygoranie', 'para', 'rabota-i-dekret', 'dengi', 'svoyo-vremya', 'telo-posle-rodov'];

// Тесты НЭН с сайта (адреса — из выгрузки архива n-e-n.ru). Открываются на сайте, нужна сеть.
export const TESTS = [
  { id: 'grandstest', title: 'Какой бабушкой вы будете?', url: 'https://n-e-n.ru/quiz/grandstest/' },
  { id: 'nostalgy', title: 'Книги нашего детства', url: 'https://n-e-n.ru/quiz/nostalgy-test-knigi-nashego-detstva/' },
  { id: 'serial', title: 'Какой сериал посмотреть на выходных', url: 'https://n-e-n.ru/quiz/test-kakoy-serial-posmotret-na-vyhodnyh/' },
  { id: 'dengi-test', title: 'Ваш тип финансового поведения', url: 'https://n-e-n.ru/quiz/dengi-test/' },
  { id: 'chat', title: 'Кто вы в родительском чате?', url: 'https://n-e-n.ru/quiz/kto-vy-v-roditelskom-chate/' },
  { id: 'granola', title: 'Мама-Гранола или Горячая Мамочка?', url: 'https://n-e-n.ru/quiz/mama-granola-ili-goracaa-mamocka/' },
  { id: '90e', title: 'Хорошо ли вы помните 90-е?', url: 'https://n-e-n.ru/quiz/test-horosho-li-vy-pomnite-90e/' },
  { id: '2000e', title: 'Хорошо ли вы помните 2000-е?', url: 'https://n-e-n.ru/quiz/test-horosho-li-vy-pomnite-2000e/' },
  { id: 'perfectmoms', title: 'Самый точный тест на идеальную мать', url: 'https://n-e-n.ru/quiz/perfectmoms/' },
  { id: 'kto-skazal', title: 'Угадайте, кому принадлежит цитата о родительстве', url: 'https://n-e-n.ru/quiz/kto-skazal/' },
];
// Тяжёлые темы — не в ленте развлечений, а в подборке (бриф, «Тесты»)
export const TOPIC_TESTS = {
  'abjuz-test': { id: 'abjuz-test', title: 'Есть ли абьюз в ваших отношениях?', url: 'https://n-e-n.ru/quiz/abjuz-test/' },
  'dengi-test': { id: 'dengi-test', title: 'Ваш тип финансового поведения', url: 'https://n-e-n.ru/quiz/dengi-test/' },
};

// «Если тяжело» — экран 8. Первый абзац — черновик, вычитка редакции и психолога (бриф).
// «Что можно сделать» — из карточки «Поддержка для родителей» в приложении, слово в слово.
// «Если тяжело не первый день» — из app-content/calm/kak-vy.md, раздел 8.
export const HELP = {
  lead: 'Тяжёлые дни бывают у всех, кто растит ребёнка: усталость, слёзы, злость, мысль «я не справляюсь». Это не значит, что с вами что-то не так.',
  practices: ['rebenok-plachet-sil-net', 'ya-zlyus'],
  many: [
    { id: 'mne-stydno', t: '«Мне стыдно, что мне тяжело»' },
    { id: 'babyblues', t: 'Родила и приуныла: что такое бэби-блюз?' },
    { id: 'eto-kakaa-to-pustota-vnutri-ni-zalosti-ni-zlosti-ni-lubvi-cto-takoe-emocional-noe-vygoranie-zensiny-v-dekrete', t: '«Это какая-то пустота внутри»' },
    { id: 'angryhack', t: 'Я очень злюсь на ребёнка. Как это прекратить?' },
  ],
  manyMore: 'ustalost-i-vygoranie',
  todo: [
    'Если вам тяжело, попросите близкого человека о конкретной помощи: принести еду, помочь по дому или побыть с ребёнком, пока вы отдыхаете или обращаетесь к специалисту. Можно прямо сказать, какая поддержка нужна сейчас.',
    'Не требуйте от себя слишком многого. Отдых — это забота о себе. Если справляться трудно, можно обратиться к врачу, психологу или психотерапевту. Поддержка близких не заменяет профессиональную помощь.',
  ],
  notFirstDay: 'Если вам тяжело не первый день — вы много плачете, не можете уснуть, даже когда есть возможность, всё время тревожитесь или ничего не радует, — об этом стоит рассказать врачу или психологу.',
  psychologist: { id: 'findanexpert', t: 'Где найти психолога', s: '5 способов и не разориться' },
};

// Телефоны помощи — app-content/calm/kak-vy.md, раздел 6 (номера сверены редакцией 19.09.2026).
// Показываются на экранах «Как вы?»; в «Если тяжело» — только 112 и 103 тихой строкой (экран 8).
export const PHONES = [
  { tel: '112', label: '112', text: 'если есть угроза жизни.' },
  { tel: '88002000122', label: '8-800-2000-122', alt: { tel: '124', label: '124' }, text: 'детский телефон доверия. Помогает детям и родителям, бесплатно и анонимно. С мобильного — 124.' },
  { tel: '+74959895050', label: '+7 (495) 989-50-50', text: 'телефон психологической помощи МЧС России.' },
];

// Статья по id: из общей ленты (articles.js) или из подборок «Для себя»
export function anyArticle(id) {
  const a = articleById(id);
  if (a) return { ...a, shared: true };
  const b = statyaById(id);
  return b ? { ...b, shared: false } : null;
}
// Общая читалка — для статей из articles.js; для остальных — читалка «Для себя»
export const articleRoute = (id) => (articleById(id) ? `/statya/${id}` : `/dlya-sebya/statya/${id}`);

// Короткая строка статьи: своя из подборки или заголовок до двоеточия
export function rowText(item) {
  const a = anyArticle(item.id);
  if (!a) return null;
  if (item.t) return { t: item.t, s: item.s || '' };
  const i = a.title.indexOf(': ');
  if (i > 10 && i < 80) {
    const rest = a.title.slice(i + 2);
    return { t: a.title.slice(0, i), s: rest[0].toUpperCase() + rest.slice(1) };
  }
  return { t: a.title, s: '' };
}
