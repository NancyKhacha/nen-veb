// «Что надеть» — короткие выдержки из материалов НЭН, как в приложении: app/src/weather/clothing.ts.
// Погода — из прогноза (журнал, 5 ноября); способ прогулки — по возрасту, его можно поменять.
// Реклама (гид по демисезону, Lassie) в выдачу не попадает — так же, как в приложении.

export const WEAR_SOURCES = {
  GUL: { title: 'Первые прогулки с новорожденным: вопросы, которые вы хотели задать педиатру, но постеснялись', url: 'https://n-e-n.ru/gulat-s-mladencem/' },
  WIN: { title: 'Как одевать ребенка на зимнюю прогулку', url: 'https://n-e-n.ru/wintercloth/' },
  SL: { title: 'Слинги и эргорюкзаки: в чем прикол, как выбрать и как носить? Большой гид для начинающих', url: 'https://n-e-n.ru/sling/' },
  BH26: { title: 'Как защитить младенца от жары: советы педиатров для родителей', url: 'https://n-e-n.ru/babyheathacks/' },
  ZH: { title: 'Прохладные советы: как быстро охладиться в жаркий день', url: 'https://n-e-n.ru/zharko/' },
};

export const WEAR_ADVICE = [
  { id: 'gulat-layers', text: 'Один слой одежды можно в любой момент добавить или убрать.', context: 'cold-any-age', src: 'GUL' },
  { id: 'gulat-check', text: 'Потрогайте верхнюю часть груди и заднюю часть шеи.', context: 'infant-comfort', src: 'GUL' },
  { id: 'winter-inactive', text: 'Младенцам и неходячим детям стоит выбирать комбинезоны толще и теплее, чем тем, кто уже сам бегает.', context: 'winter-inactive-infant', src: 'WIN' },
  { id: 'sling-lighter', text: 'Ребенка, примотанного к маме или папе, надо одевать намного легче, чем того, кто лежит в коляске.', context: 'cold-under-shared-sling-infant', src: 'SL' },
  { id: 'heat-light', text: 'Обычно достаточно легкого хлопкового боди или слипа из натуральной ткани.', context: 'hot-infant', src: 'BH26' },
  { id: 'heat-stroller', text: 'Не накрывайте коляску пеленкой.', context: 'hot-infant-stroller', src: 'BH26' },
  { id: 'zharko-light', text: 'Для прогулки выбирайте легкую, свободную одежду из хлопка.', context: 'hot-general', src: 'ZH' },
  { id: 'zharko-color', text: 'Ищите одежду светлых цветов.', context: 'hot-general', src: 'ZH' },
];

export const WEAR_WEATHER = [['frost', 'Мороз'], ['cold', 'Холодно'], ['cool', 'Прохладно'], ['warm', 'Тепло'], ['hot', 'Жарко']];
export const WEAR_MODES = [['stroller', 'Коляска'], ['sling', 'Слинг'], ['walk', 'Пешком']];

// Как selectClothingAdvice в приложении: { cat, mode, activity, sling }, infant — младше года по дате рождения
export function selectWear({ cat, mode, activity, sling } = {}, infant = false) {
  const cold = cat === 'frost' || cat === 'cold';
  const ready = !!cat && !!mode;
  const advice = !ready ? [] : WEAR_ADVICE.filter((a) => {
    switch (a.context) {
      case 'cold-any-age': return cold;
      case 'infant-comfort': return infant;
      case 'winter-inactive-infant': return cat === 'frost' && infant && activity === 'inactive';
      case 'cold-under-shared-sling-infant': return cold && infant && mode === 'sling' && sling === 'under';
      case 'hot-infant': return cat === 'hot' && infant;
      case 'hot-infant-stroller': return cat === 'hot' && infant && mode === 'stroller';
      case 'hot-general': return cat === 'hot';
      default: return false;
    }
  });
  const related = cold ? ['GUL', 'WIN', ...(mode === 'sling' ? ['SL'] : [])]
    : cat === 'hot' ? [...(infant ? ['BH26'] : []), 'ZH'] : ['GUL', 'WIN', 'ZH'];
  const needs = [];
  if (ready && cat === 'frost' && infant && activity !== 'active' && activity !== 'inactive') needs.push('activity');
  if (ready && cold && infant && mode === 'sling' && sling !== 'under' && sling !== 'over') needs.push('sling');
  return { ready, advice, related, needs };
}

// ——— Что надеть сейчас: сразу ответ по прогнозу (журнал, 5 ноября: Анастасия — «мы и так говорим,
// какая погода, не надо спрашивать ещё раз»). Слои — общепринятые правила (младенцу — на слой больше,
// чем взрослому; в слинге — легче; бегающему — как себе), черновик Claude: до выпуска — вычитка
// редакции и педиатра. В приложении Марии одежда по прогнозу не подбирается — это её решение, вопрос ей.
export function wearCat(t) {
  if (t == null) return null;
  if (t <= -11) return 'hardfrost';
  if (t <= -1) return 'frost';
  if (t <= 9) return 'cold';
  if (t <= 17) return 'cool';
  if (t <= 24) return 'warm';
  return 'hot';
}
const L = {
  baby: {
    hot: ['Лёгкое хлопковое боди или слип', 'Панамка от солнца', 'Коляску не накрывайте пелёнкой — пусть продувается'],
    warm: ['Боди с коротким рукавом и тонкий слип', 'Лёгкая шапочка или панама', 'Тонкая пелёнка — под рукой, если подует'],
    cool: ['Боди с длинным рукавом', 'Слип или кофта и штаны', 'Флисовый комбинезон или тёплая кофта', 'Тонкая шапка', 'Плед в коляску'],
    cold: ['Боди с длинным рукавом', 'Тёплый слип или флис', 'Демисезонный комбинезон', 'Шапка, носки потеплее', 'Плед или конверт в коляску'],
    frost: ['Боди с длинным рукавом', 'Флисовый или шерстяной слип', 'Зимний комбинезон или конверт', 'Тёплая шапка, варежки, пинетки'],
    hardfrost: ['Как в мороз, плюс конверт поверх комбинезона', 'Щёки — жирным детским кремом', 'Гуляйте короче, чем обычно'],
  },
  kid: {
    hot: ['Футболка и шорты из хлопка, светлые', 'Панама или кепка', 'Вода с собой'],
    warm: ['Футболка, лёгкие штаны или шорты', 'Кофта — в рюкзак на вечер'],
    cool: ['Лонгслив и кофта или толстовка', 'Ветровка', 'Тонкая шапка — если ветер'],
    cold: ['Лонгслив или термобельё', 'Флисовая кофта', 'Демисезонная куртка и штаны', 'Шапка, снуд, перчатки'],
    frost: ['Термобельё', 'Флис или шерсть', 'Зимний комбинезон или куртка и полукомбинезон', 'Тёплая шапка, снуд, варежки, зимняя обувь'],
    hardfrost: ['Как в мороз, лицо — под снуд', 'Варежки — запасные', 'Гуляйте короче, чем обычно'],
  },
};
// { cat, age: 'baby'|'kid', mode, precip: 'rain'|'snow'|null, windy } → { rule, layers }
export function wearNow({ cat, age, mode, precip, windy }) {
  const layers = [...(L[age][cat] || [])];
  if (precip === 'rain') layers.push(age === 'baby' && mode === 'stroller' ? 'Дождевик на коляску' : 'Непромокаемая куртка и резиновые сапоги');
  if (precip === 'snow' && age === 'kid') layers.push('Непромокаемые штаны или комбинезон — для снега');
  if (windy && cat !== 'hot' && cat !== 'warm') layers.push(age === 'baby' ? 'Ветер — поднимите капюшон коляски' : 'Ветер — капюшон или ветрозащитная шапка');
  let rule = age === 'baby' ? 'На младенце — на один слой больше, чем на вас.' : 'Если бегает — одевайте почти как себя, если сидит — на слой теплее.';
  if (mode === 'sling' && cat !== 'hot') rule = 'В слинге ребёнка греет ваше тепло — на слой легче, чем в коляске; сверху — слингокуртка или ваша куртка.';
  if (cat === 'hot') rule = 'В жару главное — не перегреть: меньше слоёв, светлое, тень и вода.';
  return { rule, layers };
}
