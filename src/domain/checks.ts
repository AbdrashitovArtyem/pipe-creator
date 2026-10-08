import type { PipeDesign } from './types'
import type { Calc } from './calculator'
import { formatLen } from './format'
import { derivedKnobs, shapeById } from './shapes'
import { woodById } from './woods'

export type Severity = 'ok' | 'warn' | 'bad'

export interface Check {
  id: string
  severity: Severity
  title: string
  detail: string
}

export function evaluate(design: PipeDesign, calc: Calc): Check[] {
  const wood = woodById(design.woodId)
  const min = wood.minWall
  const L = calc.layout
  const checks: Check[] = []

  const side = Math.min(L.rimWall, L.minSideWall)
  if (side < min) {
    checks.push({
      id: 'wall',
      severity: 'bad',
      title: 'Стенка чаши тонкая',
      detail: `Самое тонкое место ${side.toFixed(1)} мм, для ${wood.name.toLowerCase()} нужно не меньше ${min.toLocaleString('ru-RU')} мм. Тонкая стенка греет пальцы и быстрее выгорает.`,
    })
  } else if (side < min + 1.2) {
    checks.push({
      id: 'wall',
      severity: 'warn',
      title: 'Стенка на пределе',
      detail: `${side.toFixed(1)} мм при пороге ${min.toLocaleString('ru-RU')} мм. Кольца, ямка или кривое сверление съедят запас.`,
    })
  } else {
    checks.push({
      id: 'wall',
      severity: 'ok',
      title: 'Стенка чаши',
      detail: `Минимум ${side.toFixed(1)} мм, порог для этой породы ${min.toLocaleString('ru-RU')} мм.`,
    })
  }

  if (L.heelWall < min) {
    checks.push({
      id: 'heel',
      severity: 'bad',
      title: 'Дно камеры близко к пятке',
      detail: `Под камерой ${L.heelWall.toFixed(1)} мм дерева. Сверло легко пробьёт пятку. Останови камеру раньше.`,
    })
  } else if (L.heelWall < min + 1) {
    checks.push({
      id: 'heel',
      severity: 'warn',
      title: 'Пятка тонковата',
      detail: `${L.heelWall.toFixed(1)} мм под камерой. На последнем миллиметре сверли с частыми проверками.`,
    })
  }

  if (L.shankWall < 2.5) {
    checks.push({
      id: 'shank',
      severity: 'bad',
      title: 'Шинка не держит гнездо',
      detail: `Вокруг гнезда ${L.shankWall.toFixed(1)} мм. Шинка треснет раньше цапфы. Увеличь диаметр шинки или уменьши гнездо.`,
    })
  } else if (L.shankWall < 3.2) {
    checks.push({
      id: 'shank',
      severity: 'warn',
      title: 'Стенка шинки скромная',
      detail: `${L.shankWall.toFixed(1)} мм вокруг гнезда. Для тонкой шинки лучше вклейка Delrin, чем хрупкая цельная цапфа в тесном гнезде.`,
    })
  } else {
    checks.push({
      id: 'shank',
      severity: 'ok',
      title: 'Шинка',
      detail: `Вокруг гнезда ${L.shankWall.toFixed(1)} мм дерева.`,
    })
  }

  if (calc.tenonWall < 1.2) {
    checks.push({
      id: 'tenon',
      severity: 'bad',
      title: 'Цапфа слабая',
      detail: `Стенка цапфы ${calc.tenonWall.toFixed(1)} мм. Связка 1/4″ с каналом 5/32″ как раз из этой беды. Увеличь гнездо или поставь Delrin.`,
    })
  } else if (calc.tenonWall < 1.6) {
    checks.push({
      id: 'tenon',
      severity: 'warn',
      title: 'Цапфа тонкая',
      detail: `${calc.tenonWall.toFixed(1)} мм стенки. На вулканите живёт, но удар лучше примет Delrin, чем лопнувшая шинка.`,
    })
  } else {
    checks.push({
      id: 'tenon',
      severity: 'ok',
      title: 'Цапфа',
      detail: `Стенка ${calc.tenonWall.toFixed(1)} мм, длина ${calc.tenonLength.toFixed(1)} мм.`,
    })
  }

  if (design.airwayDiameter < 3.2 || design.airwayDiameter > 4.5) {
    checks.push({
      id: 'airway',
      severity: 'warn',
      title: 'Диаметр канала редкий',
      detail: calc.openness,
    })
  } else {
    checks.push({
      id: 'airway',
      severity: 'ok',
      title: 'Канал',
      detail: calc.openness,
    })
  }

  if (design.chamberDiameter < 17) {
    checks.push({
      id: 'chamber',
      severity: 'warn',
      title: 'Узкая камера',
      detail: 'Меньше 17 мм камера гонит жар в маленькое пятно. Так делают только сознательно.',
    })
  } else if (design.chamberDiameter > 28) {
    checks.push({
      id: 'chamber',
      severity: 'warn',
      title: 'Очень широкая камера',
      detail: 'Шире 28 мм — долгая чаша и много жара. Стенка снаружи должна это переживать.',
    })
  }

  if (L.breakout) {
    checks.push({
      id: 'aim',
      severity: 'bad',
      title: 'Канал выходит из шинки',
      detail: 'Ось чубука покидает дерево, не дойдя до камеры. Укороти диаметр шинки или подними пятку.',
    })
  } else if (L.aimError > 1 && design.bend === 'straight') {
    checks.push({
      id: 'aim',
      severity: 'warn',
      title: 'Канал не в центре дна',
      detail: `Промах ${L.aimError.toFixed(1)} мм. У прямой трубки канал должен коснуться дна камеры по центру, иначе там копится влага.`,
    })
  } else if (design.bend === 'straight') {
    checks.push({
      id: 'aim',
      severity: 'ok',
      title: 'Сведение канала',
      detail: 'Канал выходит к центру дна камеры.',
    })
  } else {
    checks.push({
      id: 'aim',
      severity: 'ok',
      title: 'Чубук к чаше',
      detail: `Угол от чубука к чаше ${L.shankAngleDeg.toFixed(0)}°. Чем он меньше, тем сильнее чубук задран. Канал идёт по оси чубука и касается скругления дна. Стык сидит на реальном профиле, вместе с сужением пятки.`,
    })
  }

  if (design.slotDepth < 19) {
    checks.push({
      id: 'slot',
      severity: 'warn',
      title: 'Короткая щель',
      detail: 'Щель короче 19 мм не даёт утоньшить прикус: канал 4 мм не влезает в прикус тоньше себя.',
    })
  } else {
    checks.push({
      id: 'slot',
      severity: 'ok',
      title: 'Щель',
      detail: `Глубина ${design.slotDepth.toFixed(0)} мм, высота ${design.slotHeight.toFixed(1)} мм. Основной канал останови за 12 мм до торца и добей сверлом около 1,5 мм.`,
    })
  }

  if (design.buttonThickness > 4.6) {
    checks.push({
      id: 'button',
      severity: 'warn',
      title: 'Толстый прикус',
      detail: 'Толще 4,6 мм прикус быстро устаёт. Обычный удобный диапазон 3,6–4,3 мм.',
    })
  } else if (design.buttonThickness < 3.2) {
    checks.push({
      id: 'button',
      severity: 'warn',
      title: 'Хрупкий прикус',
      detail: 'Тоньше 3,2 мм зубы прокусывают, особенно если щель уже съела середину.',
    })
  } else {
    checks.push({
      id: 'button',
      severity: 'ok',
      title: 'Прикус',
      detail: `${design.buttonThickness.toFixed(1)} мм. Кромки щели скругли, углы кнопки оставь чёткими, но не режущими.`,
    })
  }

  if (design.tenonGap < 0.6 || design.tenonGap > 1.6) {
    checks.push({
      id: 'gap',
      severity: 'warn',
      title: 'Зазор цапфы',
      detail: 'Между торцом цапфы и дном гнезда оставляют около 1 мм, чтобы стык не упирался и конденсат не собирался ступенькой.',
    })
  }

  if (design.mortiseDepth > design.shankLength - 6) {
    checks.push({
      id: 'mortise',
      severity: 'bad',
      title: 'Гнездо слишком глубокое',
      detail: 'Гнездо почти насквозь шинки. Оставь хотя бы 6 мм дерева до чаши.',
    })
  }

  checks.push({
    id: 'cleaner',
    severity: calc.cleanerOk ? 'ok' : 'warn',
    title: 'Ёршик',
    detail: calc.cleanerNote,
  })

  return checks
}

const DRIFT_FIELDS: { key: keyof PipeDesign; label: string; digits?: number }[] = [
  { key: 'bowlHeight', label: 'высота чаши' },
  { key: 'bowlDiameter', label: 'диаметр чаши' },
  { key: 'chamberDiameter', label: 'диаметр камеры' },
  { key: 'chamberDepth', label: 'глубина камеры' },
  { key: 'shankLength', label: 'длина шинки' },
  { key: 'shankDiameter', label: 'диаметр шинки' },
  { key: 'stemLength', label: 'длина мундштука' },
  { key: 'cantDeg', label: 'наклон', digits: 0 },
  { key: 'airwayDiameter', label: 'канал' },
]

export function driftFromPreset(design: PipeDesign): string[] {
  if (design.shapeId === 'custom') return []
  const preset = shapeById(design.shapeId)
  const lines: string[] = []
  for (const field of DRIFT_FIELDS) {
    const current = design[field.key]
    const origin = preset.patch[field.key as keyof typeof preset.patch]
    if (typeof current !== 'number' || typeof origin !== 'number') continue
    if (Math.abs(current - origin) > 0.2) {
      const shown =
        field.key === 'cantDeg'
          ? `${origin}° → ${current}°`
          : `${formatLen(origin, 'mm', field.digits ?? 1)} → ${formatLen(current, 'mm', field.digits ?? 1)}`
      lines.push(`${field.label}: ${shown}`)
    }
  }
  if (design.bend !== preset.patch.bend) lines.push('изгиб изменён')
  if (design.shankSection !== preset.patch.shankSection) lines.push('сечение шинки изменено')
  if (design.stemStyle !== preset.patch.stemStyle) lines.push('тип мундштука изменён')
  if (design.bowlProfile !== preset.patch.bowlProfile) lines.push('профиль чаши изменён')
  if (design.rings !== preset.patch.rings) lines.push('кольца изменены')
  if (design.flatHeel !== preset.patch.flatHeel) lines.push('пятка изменена')
  if (design.chamberTaper !== (preset.patch.bowlProfile === 'cone')) lines.push('сужение камеры изменено')
  const origin = derivedKnobs(preset.patch)
  const knobs: { key: keyof typeof origin; label: string; digits: number }[] = [
    { key: 'heelMm', label: 'скругление пятки', digits: 1 },
    { key: 'heelLeave', label: 'плавность пятки', digits: 2 },
    { key: 'peakAt', label: 'широкое место', digits: 2 },
    { key: 'rimFactor', label: 'кромка', digits: 2 },
    { key: 'footFactor', label: 'низ стенки', digits: 2 },
    { key: 'shankTaper', label: 'утолщение чубука', digits: 2 },
    { key: 'ovalRatio', label: 'овал', digits: 2 },
  ]
  for (const field of knobs) {
    const current = design[field.key]
    const from = origin[field.key]
    if (Math.abs(current - from) > 0.02) lines.push(`${field.label}: ${from.toFixed(field.digits)} → ${current.toFixed(field.digits)}`)
  }
  return lines
}
