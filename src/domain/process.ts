import type { PipeDesign } from './types'
import type { Calc } from './calculator'
import type { ToolInventory } from './tools'
import { woodById } from './woods'
export type StepFigure = 'stock' | 'mark' | 'drill' | 'chamber' | 'shape' | 'tenon' | 'stem' | 'sand' | 'finish' | 'prove' | 'kit'

export interface StepTool {
  label: string
  have: boolean
}

export interface ProcessStep {
  id: string
  title: string
  body: string
  safety?: string
  figure: StepFigure
  lines: string[]
  checks: string[]
  uses: StepTool[]
}

function hasAirwayBit(tools: ToolInventory, mm: number): boolean {
  return tools.airwayBits.some((bit) => Math.abs(bit - mm) < 0.15)
}

function chamberBitName(tools: ToolInventory): string {
  switch (tools.chamberBit) {
    case 'spade':
      return 'переточенное перо'
    case 'spoon':
      return 'ложечное сверло'
    case 'burr':
      return 'шарошка'
    default:
      return 'сверло камеры'
  }
}

export function buildProcess(design: PipeDesign, tools: ToolInventory, calc: Calc): ProcessStep[] {
  const wood = woodById(design.woodId)
  const steps: Omit<ProcessStep, 'figure' | 'lines' | 'checks' | 'uses'>[] = []
  const bent = design.bend !== 'straight'
  const canDrill =
    !tools.kit &&
    tools.chamberBit !== 'none' &&
    (tools.drillPress || tools.lathe || tools.handDrill)

  steps.push({
    id: 'stock',
    title: 'Брусок и защита',
    safety: 'Очки и респиратор до первого реза. Пыль бриара и твёрдых пород сенсибилизирует, самшит раздражает сильнее прочих.',
    body: [
      `Порода: ${wood.name}. ${wood.note}`,
      wood.id === 'morta' ? 'До разметки просмотри брусок на волосные трещины. Трещину сверление только вскроет.' : '',
      design.grain === 'plateau'
        ? 'Плато: шершавая кора может остаться на кромке свободной формы или стачивается. Зерно пусти вдоль шинки, флейм ляжет на бок чаши.'
        : 'Эбошон: торец даёт птичий глаз на чаше. Изъянов больше, для первой трубки размер держи скромным.',
      `Брусок под чашу и шинку около ${Math.ceil(calc.block.length)} × ${Math.ceil(calc.block.width)} × ${Math.ceil(calc.block.height)} мм, с припуском на пиление. Мундштук — отдельный пруток.`,
      `Порог стенки для этой породы ${wood.minWall.toLocaleString('ru-RU')} мм. ${wood.dust}`,
    ]
      .filter(Boolean)
      .join(' '),
  })

  if (tools.kit || !canDrill) {
    steps.push({
      id: 'kit',
      title: 'Готовые отверстия',
      body: tools.kit
        ? 'Набор уже несёт камеру, канал и гнездо. Размечай форму по этим осям, а не вместо них. Не сверли камеру заново.'
        : 'Сверла камеры или станка нет, поэтому камеру, канал и гнездо сам не сверли. Возьми набор с готовыми отверстиями либо сначала достань сверло со скруглённым дном и хотя бы ручную дрель в упоре.',
    })
  } else {
    const machine = tools.lathe
      ? 'На токарном камеру и шинку можно вести в одной установке. Ось не перехватывай, пока не закончены канал и гнездо.'
      : tools.drillPress
        ? 'Сверлильный станок. Брусок в тисках, один и тот же бок к себе: так левый и правый промах не уедет при повороте на камеру.'
        : 'Только ручная дрель. Зажми её в упоре на столе или веди по угольнику. Глубину отметь лентой на сверле и смотри с двух сторон.'

    steps.push({
      id: 'layout',
      title: 'Разметка',
      body: `На боковой грани начерти ось камеры с наклоном ${design.cantDeg}° и ось канала. Ось чубука прямая и касается скругления дна, а наружу выходит по реальному профилю чаши, с учётом сужения пятки. ${bent ? `Угол от чубука к чаше ${calc.layout.shankAngleDeg.toFixed(0)}°: чем меньше, тем сильнее он задран вверх. Мундштук продолжает ту же ось. Канал сверлится по этой оси.` : 'Прямая трубка: угол чубука к чаше 90°, канал горизонтален и касается дна камеры по центру.'} ${machine}`,
    })

    const airwayOwned = hasAirwayBit(tools, design.airwayDiameter)
    steps.push({
      id: 'mortise-airway',
      title: 'Гнездо и канал',
      body: [
        `Порядок отверстий: сначала канал и гнездо, потом камера. Так промах камеры ещё можно увести, а дно не пробивается вслепую.`,
        `Гнездо ${calc.bits.mortise}, глубина ${design.mortiseDepth.toLocaleString('ru-RU')} мм с торца шинки. ${
          tools.mortiseBit === 'forstner'
            ? 'Форстнер даёт плоское дно и не уводит по зерну. Дешёвый набор для торца шинки не бери, нужно шлифованное сверло.'
            : tools.mortiseBit === 'brad'
              ? 'Сверло с шипом хорошо стоит в целом дереве. Шип в центре потом ловит сверло канала.'
              : 'Концевая фреза даёт плоское дно и шаг 1/64″. Подачу держи короткую, фреза греет вулканит и бриар.'
        }`,
        `Канал ${calc.bits.airway}. Длина в бриаре около ${calc.airwayLength.toFixed(0)} мм, от дна гнезда до центра дна камеры. ${
          airwayOwned
            ? 'Такое сверло в ящике есть.'
            : `Сверла ${design.airwayDiameter.toLocaleString('ru-RU')} мм в списке нет. Купи его или смени диаметр канала на то, что уже лежит в ящике. Разный диаметр в шинке и в цапфе собирает конденсат на ступеньке.`
        }`,
        bent
          ? 'Наклони стол или брусок, чтобы сверло канала смотрело в отмеченное дно камеры, а не вдоль оси гнезда. На дне гнезда сначала наколи центр, иначе сверло уйдёт.'
          : 'Канал продолжай из центра дна гнезда тем же диаметром. Выход — в центр будущего дна камеры.',
        'Вынимай сверло часто, иначе стружка жжёт канал.',
      ].join(' '),
    })

    steps.push({
      id: 'chamber',
      title: 'Камера',
      body: [
        `Камера ${calc.bits.chamber}. Глубина ${design.chamberDepth.toLocaleString('ru-RU')} мм по оси чаши. Сверло: ${chamberBitName(tools)}.`,
        tools.chamberBit === 'burr'
          ? 'Шарошка режет чисто, но медленно. Большая подача поджигает дерево.'
          : tools.chamberBit === 'spoon'
            ? 'Ложечное сверло нужно, если формуешь чашу раньше отверстий и подаёшь её руками. Здесь отверстия первые, так что веди его со станком и упором.'
            : 'Перо со скруглёнными уголками — нормальный старт. Плоское перо оставит ступеньку, её потом не вывести ёршиком.',
        `Не досверливай сразу до канала. Остановись примерно в 3 мм, сверь ось и только потом соедини отверстия, чтобы весь диаметр канала едва показался в дне. Под камерой сейчас ${calc.layout.heelWall.toFixed(1)} мм. Если сверло прошло насквозь, брусок в отход.`,
        design.chamberTaper
          ? 'Стенки камеры слегка сходятся к дну. После цилиндрического сверла добери конус шарошкой или ножом, не задевая выход канала.'
          : 'Дно оставь круглым, по форме сверла. Плоское дно собирает влагу по краю.',
      ].join(' '),
    })
  }

  const saw = tools.bandsaw
    ? 'Грубый контур сними лентой, оставь 3–4 мм на напильник.'
    : tools.copingSaw
      ? 'Грубый контур выпили лобзиком. Ленты нет, так что не лезь пилой вплотную к линии.'
      : 'Пилы в списке нет. Если брусок уже близок к габариту, снимай рашпилем. Иначе достань хотя бы лобзик.'

  steps.push({
    id: 'shape',
    title: 'Наружная форма',
    body: [
      saw,
      latheLine(tools),
      tools.discSander
        ? 'Дальше дисковая шлифовка: чаша вращением, шинка вдоль. Диск снимает быстро, линию стыка им легко испортить.'
        : 'Диска нет. Сначала рашпилем выведи симметричные грани, чаша сверху должна читаться восьмигранником, и только потом скругляй. Так проще поймать симметрию.',
      tools.files
        ? 'Круглым напильником по стыку чаши и шинки добери ровную ложбинку. Это место выдаёт кривую трубку раньше всего.'
        : 'Напильников нет. Без них стык чаши и шинки останется рваным. Добавь хотя бы один круглый напильник.',
      design.rings
        ? 'Кольца бульдога проточи до шлифовки, пока есть запас диаметра. Глубина канавки меньше миллиметра, в стенку камеры не залезай.'
        : '',
      `Кромку камеры слегка скругли. Острый край колет палец и скалывается.`,
    ]
      .filter(Boolean)
      .join(' '),
  })

  steps.push({
    id: 'tenon',
    title: design.tenonStyle === 'delrin' ? 'Цапфа из Delrin' : 'Цельная цапфа',
    body:
      design.tenonStyle === 'delrin'
        ? `Срежь литую цапфу, выведи торец мундштука строго под 90° к оси и просверли гнездо под стержень Delrin. ${
            tools.drillPress || tools.lathe
              ? 'Торец равняй Форстнером на станке, иначе цапфа уйдёт от плоскости и стык не сойдётся.'
              : 'Без станка торец почти наверняка уйдёт. Зажми мундштук в кондукторе, не держи его в руке.'
          } Вклей на эпоксидку. Delrin скользкий и прочный. На тонкой шинке он лучше цельного вулканита: лопнет цапфа, а не шинка. Длина цапфы ${calc.tenonLength.toFixed(1)} мм, диаметр под гнездо ${design.mortiseDiameter.toLocaleString('ru-RU')} мм, зазор до дна гнезда ${design.tenonGap.toLocaleString('ru-RU')} мм.`
        : `Цельная цапфа. Диаметр подгони к гнезду пробной посадкой, не по таблице в тысячную дюйма. Садится плотно от руки, без качания и без удара. ${
            tools.tenonTool === 'lathe'
              ? 'Точи на токарном по металлу, мундштук сквозь шпиндель.'
              : tools.tenonTool === 'pimo'
                ? 'Приспособление Pimo в дрели или на станке сойдёт для старта. Освоишь посадку и захочешь нормальный токарный.'
                : 'Чем точить цапфу, в списке нет. Посадка с напильника в дрели возможна, но торец легко завалить. Достань Pimo или металлический токарный.'
          } Длина ${calc.tenonLength.toFixed(1)} мм. Торец цапфы слегка скругли, чтобы не разбивал гнездо. Между торцом и дном оставь ${design.tenonGap.toLocaleString('ru-RU')} мм.`,
  })

  steps.push({
    id: 'bend-stem',
    title: 'Мундштук и щель',
    body: [
      design.stemMaterial === 'vulcanite'
        ? 'Вулканит теплее в зубах и темнеет со временем. Немецкий пруток для ручной резки окисляется слабее дешёвых литых мундштуков.'
        : design.stemMaterial === 'cumberland'
          ? 'Камберленд — тот же эбонит с мраморным рисунком. Греется и гнётся как вулканит.'
          : 'Акрил не окисляется, в зубах холоднее и жестче. Гнуть его труднее, перегрев даёт молочные пятна.',
      bent
        ? 'Гни мундштук нагревом после того, как канал уже просверлен. Греешь пруток, не пламя в упор. Дуга снаружи, канал внутри не должен сложиться складкой.'
        : 'Мундштук прямой, греть не нужно.',
      `Канал в прутке тем же диаметром, что в шинке. За 12 мм до прикуса остановись и добей сверлом около 1,5 мм, иначе прикус не станет тоньше ${design.buttonThickness.toLocaleString('ru-RU')} мм.`,
      `Щель глубиной ${design.slotDepth.toLocaleString('ru-RU')} мм и высотой ${design.slotHeight.toLocaleString('ru-RU')} мм. ${
        tools.dremel
          ? 'Щель выбери бормашиной и игловидными напильниками. Края щели скругли, дно выведи без ступеньки к каналу.'
          : 'Бормашины нет. Щель придётся пилить игловидными напильниками от маленького отверстия. Дольше, но ступеньку всё равно нельзя оставлять: в ней свистит тяга.'
      }`,
      design.stemStyle === 'saddle'
        ? 'Седло держи полное сечение у шинки и уводи на тонкий прикус одним уступом, без волны.'
        : 'Конус уводи ровно от торца шинки к прикусу.',
    ].join(' '),
  })

  steps.push({
    id: 'sand',
    title: 'Шлифовка',
    body: 'Зерно по очереди: 150, 220, 360, 400, 600. Следующее зерно не начинай, пока не сняты риски предыдущего. Смочи спиртом: пыль уходит, царапина видна. Бриар полируется высоко, а трубку рассматривают вблизи, так что след напильника не спрятать.',
    safety: 'Мокрый спирт горюч. Не шлифуй рядом с нагревом мундштука.',
  })

  const stain =
    design.finish === 'sandblast'
      ? tools.sandblaster
        ? 'Пескоструй до морилки. Мягкое зерно уйдёт, твёрдое останется. Закрой цапфу и канал пробками. После струи контрастная морилка и воск.'
        : 'Пескоструя нет. Либо отложи такую отделку, либо переключи трубку на гладкую. Рустикация бормашиной даёт другой рисунок, не рисунок струи.'
      : design.finish === 'rusticated'
        ? 'Рустикация: выбери мягкие места бормашиной или грубым камнем, потом спиртовая морилка. Под гладкий воск рустикацию не тяни. Если кругов нет, хватит шеллака.'
        : 'Гладкая отделка. Спиртовая анилиновая или кожаная морилка, тон разведи спиртом. Пятна от разной плотности бриара не затирай до дыр.'

  steps.push({
    id: 'finish',
    title: 'Отделка',
    body: [
      stain,
      tools.buffer
        ? 'Круги не мешай. Один под коричневый триполи, один под белый, отдельный бязевый под карнаубский воск, фланель на последний проход. Воск тонко, иначе кромка щели заплывёт.'
        : 'Полировального круга нет. Карнаубский воск втирай тканью по уже закрытой шлифовке. Шагов с кругом в этой трубке нет.',
      'Стык мундштука и шинки полируй вместе, чтобы не снять фаску только с одной стороны.',
    ].join(' '),
  })

  steps.push({
    id: 'prove',
    title: 'Проверка перед первой чашей',
    body: [
      calc.cleanerNote,
      'Пустая тяга ровная, без свиста. Свист почти всегда в щели, а не в бриаре.',
      'Ёршик выходит в центр дна камеры, без ступеньки на стыке цапфы.',
      `Стенка не тоньше ${wood.minWall.toLocaleString('ru-RU')} мм. ${wood.heat <= 2 ? 'Порода слабая на жар: первую чашу не высушивай до горького, нагар в камере береги.' : 'Первые чаши дольше обычного, вкус дерева уйдёт под нагар.'}`,
      tools.calipers
        ? 'Пройди штангенциркулем стенку, цапфу и прикус и сверь с карточкой.'
        : 'Штангенциркуля нет. Хотя бы кронциркуль или хвостовик сверла: стенку на глаз оставлять не стоит.',
    ].join(' '),
  })

  return steps.map((item) => ({
    ...item,
    figure: figureOf(item.id),
    lines: item.body
      .split(/(?<=\.)\s+/)
      .map((line) => line.trim())
      .filter(Boolean),
    checks: checksOf(item.id),
    uses: usesOf(item.id, tools, design),
  }))
}

function figureOf(id: string): StepFigure {
  switch (id) {
    case 'stock':
      return 'stock'
    case 'layout':
      return 'mark'
    case 'mortise-airway':
      return 'drill'
    case 'chamber':
      return 'chamber'
    case 'shape':
      return 'shape'
    case 'tenon':
      return 'tenon'
    case 'bend-stem':
      return 'stem'
    case 'sand':
      return 'sand'
    case 'finish':
      return 'finish'
    case 'prove':
      return 'prove'
    default:
      return 'kit'
  }
}

function checksOf(id: string): string[] {
  switch (id) {
    case 'stock':
      return ['Очки и респиратор на месте', 'Брусок без сквозной трещины', 'Размер бруска не меньше карточки']
    case 'kit':
      return ['Оси готовых отверстий перенесены на грани', 'Камеру заново не сверлил']
    case 'layout':
      return ['Ось камеры и ось канала на боковой грани', 'Канал смотрит в центр будущего дна']
    case 'mortise-airway':
      return ['Гнездо нужной глубины, дно плоское', 'Канал вынут часто, без прижога', 'Сверло канала есть в ящике']
    case 'chamber':
      return ['Остановился за 3 мм до канала', 'Дно камеры соединилось с каналом по центру', 'Стенка под дном не пробита']
    case 'shape':
      return ['Контур с припуском, не вплотную к линии', 'Стык чаши и шинки без рваной впадины', 'Кромка камеры скруглена']
    case 'tenon':
      return ['Цапфа садится от руки, без качания', 'Зазор до дна гнезда оставлен']
    case 'bend-stem':
      return ['Канал мундштука того же диаметра', 'Щель без ступеньки к каналу', 'Прикус не тоньше карточки']
    case 'sand':
      return ['Риски прошлого зерна сняты', 'Спиртом проверены царапины']
    case 'finish':
      return ['Морилка без дыр в стенке', 'Стык мундштука и шинки полирован вместе']
    case 'prove':
      return ['Тяга ровная, без свиста', 'Ёршик выходит в центр дна', 'Стенка не тоньше породы']
    default:
      return ['Шаг сделан']
  }
}

function usesOf(id: string, tools: ToolInventory, design: PipeDesign): StepTool[] {
  const drill = tools.lathe ? 'токарный' : tools.drillPress ? 'сверлильный станок' : 'ручная дрель'
  const drillHave = tools.lathe || tools.drillPress || tools.handDrill
  switch (id) {
    case 'stock':
      return [{ label: 'брусок и защита', have: true }]
    case 'kit':
      return [{ label: 'набор с отверстиями', have: tools.kit || !drillHave }]
    case 'layout':
      return [
        { label: drill, have: drillHave },
        { label: 'штангенциркуль', have: tools.calipers },
      ]
    case 'mortise-airway':
      return [
        { label: drill, have: drillHave },
        { label: tools.mortiseBit === 'forstner' ? 'Форстнер' : tools.mortiseBit === 'brad' ? 'сверло с шипом' : 'фреза', have: true },
        { label: `канал ${design.airwayDiameter.toLocaleString('ru-RU')} мм`, have: hasAirwayBit(tools, design.airwayDiameter) },
      ]
    case 'chamber':
      return [
        { label: drill, have: drillHave },
        { label: chamberBitName(tools), have: tools.chamberBit !== 'none' },
      ]
    case 'shape':
      return [
        { label: tools.bandsaw ? 'лента' : tools.copingSaw ? 'лобзик' : 'пила', have: tools.bandsaw || tools.copingSaw },
        { label: tools.lathe ? 'токарный' : 'рашпиль', have: tools.lathe || tools.files },
        { label: 'круглый напильник', have: tools.files },
      ]
    case 'tenon':
      return [
        {
          label: tools.tenonTool === 'lathe' ? 'токарный по металлу' : tools.tenonTool === 'pimo' ? 'Pimo' : 'проточка цапфы',
          have: tools.tenonTool !== 'none',
        },
      ]
    case 'bend-stem':
      return [
        { label: design.bend === 'straight' ? 'прямой мундштук' : 'нагрев мундштука', have: true },
        { label: 'бормашина', have: tools.dremel },
      ]
    case 'sand':
      return [{ label: 'шкурка 150–600', have: true }]
    case 'finish':
      return [
        { label: design.finish === 'sandblast' ? 'пескоструй' : design.finish === 'rusticated' ? 'рустикация' : 'морилка', have: design.finish !== 'sandblast' || tools.sandblaster },
        { label: 'полировальный круг', have: tools.buffer },
      ]
    case 'prove':
      return [{ label: 'штангенциркуль', have: tools.calipers }]
    default:
      return []
  }
}

function latheLine(tools: ToolInventory): string {
  if (!tools.lathe) return ''
  return 'Токарный есть: цилиндр шинки и черновую чашу сними на нём, характер формы добери уже напильником.'
}
