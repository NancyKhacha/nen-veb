// «Что надеть» — короткие выдержки из материалов НЭН, как в приложении: app/src/weather/clothing.ts.
// Погоду и способ прогулки выбирает человек: прогноз не задаёт одежду (вопрос Марии).
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
