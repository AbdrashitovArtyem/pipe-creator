import type { BowlProfile, PipeDesign, ShankSection } from './types'
import { uid } from './format'

export interface ShapeKnobs {
  heelMm: number
  heelLeave: number
  peakAt: number
  rimFactor: number
  footFactor: number
  shankTaper: number
  ovalRatio: number
}

/** Канон пятки, кромки и чубука для данной чаши. Калькулятор подставляет это при выборе формы и даёт править. */
export function derivedKnobs(design: {
  bowlProfile: BowlProfile
  bowlHeight: number
  bowlDiameter: number
  flatHeel: boolean
  rings: 0 | 1 | 2
  shankSection: ShankSection
}): ShapeKnobs {
  const H = Math.max(8, design.bowlHeight)
  const R = Math.max(1, design.bowlDiameter / 2)
  const aspect = H / Math.max(1, design.bowlDiameter)
  const cap = (fracH: number, fracR: number) => Math.round(Math.min(H * 0.55, H * fracH, R * fracR) * 10) / 10
  const base = { shankTaper: 0.14, ovalRatio: 0.62 }
  if (design.rings > 0) {
    return {
      ...base,
      heelMm: design.shankSection === 'diamond' ? 0 : Math.round(Math.min(9, H * 0.2) * 10) / 10,
      heelLeave: 0.4,
      peakAt: 0.7,
      rimFactor: 0.8,
      footFactor: 0.42,
    }
  }
  if (design.flatHeel) {
    return { ...base, heelMm: 0, heelLeave: 0.4, peakAt: 1, rimFactor: 1, footFactor: 1 }
  }
  switch (design.bowlProfile) {
    case 'apple':
      return { ...base, heelMm: cap(0.4, 0.9), heelLeave: 0.78, peakAt: 0.48, rimFactor: 0.82, footFactor: 0.88 }
    case 'egg':
      return { ...base, heelMm: cap(0.32, 0.78), heelLeave: 0.68, peakAt: 0.34, rimFactor: 0.82, footFactor: 0.88 }
    case 'brandy':
      return { ...base, heelMm: cap(0.3, 0.74), heelLeave: 0.72, peakAt: 0.32, rimFactor: 0.76, footFactor: 0.88 }
    case 'cone':
      return { ...base, heelMm: cap(0.18, 0.4), heelLeave: 0.32, peakAt: 1, rimFactor: 1, footFactor: 0.64 }
    default:
      if (aspect < 0.85) return { ...base, heelMm: cap(0.42, 0.52), heelLeave: 0.56, peakAt: 0.5, rimFactor: 0.96, footFactor: 0.96 }
      if (aspect > 1.45) return { ...base, heelMm: cap(0.14, 0.34), heelLeave: 0.28, peakAt: 0.5, rimFactor: 0.96, footFactor: 0.96 }
      return { ...base, heelMm: cap(0.26, 0.44), heelLeave: 0.4, peakAt: 0.5, rimFactor: 0.96, footFactor: 0.96 }
  }
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Старые проекты без новых полей получают канон своей формы. */
export function ensureKnobs(design: PipeDesign): PipeDesign {
  const rings = design.rings === 1 || design.rings === 2 ? design.rings : 0
  const knobs = derivedKnobs({
    bowlProfile: design.bowlProfile || 'cylinder',
    bowlHeight: design.bowlHeight,
    bowlDiameter: design.bowlDiameter,
    flatHeel: Boolean(design.flatHeel),
    rings,
    shankSection: design.shankSection || 'round',
  })
  return {
    ...design,
    rings,
    flatHeel: Boolean(design.flatHeel),
    heelMm: finite(design.heelMm, knobs.heelMm),
    heelLeave: finite(design.heelLeave, knobs.heelLeave),
    peakAt: finite(design.peakAt, knobs.peakAt),
    rimFactor: finite(design.rimFactor, knobs.rimFactor),
    footFactor: finite(design.footFactor, knobs.footFactor),
    shankTaper: finite(design.shankTaper, knobs.shankTaper),
    ovalRatio: finite(design.ovalRatio, knobs.ovalRatio),
    chamberTaper: typeof design.chamberTaper === 'boolean' ? design.chamberTaper : design.bowlProfile === 'cone',
  }
}

export interface ShapePreset {
  id: string
  name: string
  hint: string
  patch: Omit<
    PipeDesign,
    | 'id'
    | 'name'
    | 'shapeId'
    | 'woodId'
    | 'stemMaterial'
    | 'tenonStyle'
    | 'finish'
    | 'grain'
    | 'blankLength'
    | 'blankWidth'
    | 'blankHeight'
    | 'heelMm'
    | 'heelLeave'
    | 'peakAt'
    | 'rimFactor'
    | 'footFactor'
    | 'shankTaper'
    | 'ovalRatio'
    | 'chamberTaper'
  >
}

const common = {
  airwayDiameter: 4,
  mortiseDiameter: 7.9,
  mortiseDepth: 18,
  tenonGap: 1,
  slotDepth: 20,
  slotHeight: 1.4,
  buttonThickness: 4,
  rings: 0 as const,
  flatHeel: false,
}

export const SHAPES: ShapePreset[] = [
  {
    id: 'billiard',
    name: 'Бильярд',
    hint: 'Прямая чаша со скруглённой пяткой, круглая шинка равна высоте чаши, конусный мундштук, наклон 3°.',
    patch: {
      ...common,
      bowlHeight: 48,
      bowlDiameter: 38,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 20,
      chamberDepth: 38,
      shankLength: 48,
      shankDiameter: 17,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 70,
      stemStyle: 'taper',
    },
  },
  {
    id: 'bent-billiard',
    name: 'Гнутый бильярд',
    hint: 'Та же чаша. Чубук прямой и задран вверх, угол к чаше около 62°.',
    patch: {
      ...common,
      bowlHeight: 48,
      bowlDiameter: 38,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 20,
      chamberDepth: 38,
      shankLength: 46,
      shankDiameter: 17,
      shankSection: 'round',
      bend: 'half',
      stemLength: 68,
      stemStyle: 'taper',
    },
  },
  {
    id: 'apple',
    name: 'Яблоко',
    hint: 'Почти шар, кромка уже середины. Чаще с лёгким изгибом: чаша тяжелее бильярда.',
    patch: {
      ...common,
      bowlHeight: 42,
      bowlDiameter: 46,
      cantDeg: 2,
      bowlProfile: 'apple',
      chamberDiameter: 21,
      chamberDepth: 32,
      shankLength: 40,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'eighth',
      stemLength: 66,
      stemStyle: 'taper',
    },
  },
  {
    id: 'dublin',
    name: 'Дублин',
    hint: 'Конус: шире у кромки, уже к пятке. Камера тоже чуть сходится.',
    patch: {
      ...common,
      bowlHeight: 50,
      bowlDiameter: 42,
      cantDeg: 3,
      bowlProfile: 'cone',
      chamberDiameter: 22,
      chamberDepth: 40,
      shankLength: 48,
      shankDiameter: 17,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 70,
      stemStyle: 'taper',
    },
  },
  {
    id: 'pot',
    name: 'Горшок',
    hint: 'Бильярд, у которого снята верхняя треть: чаша шире, чем высокая, шинка чуть длиннее неё.',
    patch: {
      ...common,
      bowlHeight: 30,
      bowlDiameter: 48,
      cantDeg: 2,
      bowlProfile: 'cylinder',
      chamberDiameter: 23,
      chamberDepth: 22,
      shankLength: 40,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 58,
      stemStyle: 'taper',
    },
  },
  {
    id: 'poker',
    name: 'Покер',
    hint: 'Короткий цилиндр с плоской пяткой: стоит на столе. Шинка примерно как высота чаши, мундштук седлом.',
    patch: {
      ...common,
      bowlHeight: 34,
      bowlDiameter: 46,
      cantDeg: 2,
      bowlProfile: 'cylinder',
      flatHeel: true,
      chamberDiameter: 22,
      chamberDepth: 26,
      shankLength: 34,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 52,
      stemStyle: 'saddle',
    },
  },
  {
    id: 'chimney',
    name: 'Камин',
    hint: 'Тот же цилиндр, что у бильярда, но камера намного выше. Шинка около двух третей высоты.',
    patch: {
      ...common,
      bowlHeight: 70,
      bowlDiameter: 32,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 17.5,
      chamberDepth: 56,
      shankLength: 46,
      shankDiameter: 16,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 64,
      stemStyle: 'taper',
    },
  },
  {
    id: 'prince',
    name: 'Принц',
    hint: 'Приплюснутое яблоко, шинка около трёх четвертей высоты чаши, длинный чуть гнутый мундштук.',
    patch: {
      ...common,
      bowlHeight: 32,
      bowlDiameter: 44,
      cantDeg: 2,
      bowlProfile: 'apple',
      chamberDiameter: 20,
      chamberDepth: 24,
      shankLength: 24,
      shankDiameter: 16,
      shankSection: 'round',
      bend: 'eighth',
      stemLength: 108,
      stemStyle: 'taper',
    },
  },
  {
    id: 'bulldog',
    name: 'Бульдог',
    hint: 'Два конуса основаниями друг к другу, кольца на широком месте. Низ сходится ромбом в нижнюю грань шинки.',
    patch: {
      ...common,
      bowlHeight: 46,
      bowlDiameter: 44,
      cantDeg: 2,
      bowlProfile: 'cone',
      rings: 2,
      chamberDiameter: 21,
      chamberDepth: 36,
      shankLength: 42,
      shankDiameter: 18,
      shankSection: 'diamond',
      bend: 'straight',
      stemLength: 64,
      stemStyle: 'taper',
    },
  },
  {
    id: 'rhodesian',
    name: 'Родезийский',
    hint: 'Та же чаша, что у бульдога, но круглая шинка. Изгиб чаще четверть, не половина.',
    patch: {
      ...common,
      bowlHeight: 46,
      bowlDiameter: 44,
      cantDeg: 2,
      bowlProfile: 'cone',
      rings: 2,
      chamberDiameter: 21,
      chamberDepth: 36,
      shankLength: 40,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'quarter',
      stemLength: 64,
      stemStyle: 'taper',
    },
  },
  {
    id: 'canadian',
    name: 'Канадец',
    hint: 'Овальная шинка в полтора-два раза длиннее высоты чаши, конусный мундштук.',
    patch: {
      ...common,
      bowlHeight: 46,
      bowlDiameter: 38,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 20,
      chamberDepth: 36,
      shankLength: 80,
      shankDiameter: 24,
      shankSection: 'oval',
      bend: 'straight',
      stemLength: 58,
      stemStyle: 'taper',
    },
  },
  {
    id: 'lovat',
    name: 'Ловат',
    hint: 'Длинная круглая шинка, примерно полторы высоты чаши, седловидный мундштук.',
    patch: {
      ...common,
      bowlHeight: 46,
      bowlDiameter: 38,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 20,
      chamberDepth: 36,
      shankLength: 70,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 58,
      stemStyle: 'saddle',
    },
  },
  {
    id: 'liverpool',
    name: 'Ливерпуль',
    hint: 'Круглая шинка длиннее двух высот чаши, короткий конусный мундштук.',
    patch: {
      ...common,
      bowlHeight: 44,
      bowlDiameter: 36,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 19.5,
      chamberDepth: 34,
      shankLength: 90,
      shankDiameter: 16.5,
      shankSection: 'round',
      bend: 'straight',
      stemLength: 46,
      stemStyle: 'taper',
    },
  },
  {
    id: 'lumberman',
    name: 'Лесоруб',
    hint: 'Очень длинная овальная шинка и короткое седло.',
    patch: {
      ...common,
      bowlHeight: 44,
      bowlDiameter: 36,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 19.5,
      chamberDepth: 34,
      shankLength: 90,
      shankDiameter: 24,
      shankSection: 'oval',
      bend: 'straight',
      stemLength: 50,
      stemStyle: 'saddle',
    },
  },
  {
    id: 'churchwarden',
    name: 'Черчварден',
    hint: 'Длинный мундштук от 230 мм. Чаша меньше, изгиб едва намечен. Его же зовут гэндальфом.',
    patch: {
      ...common,
      bowlHeight: 42,
      bowlDiameter: 36,
      cantDeg: 3,
      bowlProfile: 'cylinder',
      chamberDiameter: 19,
      chamberDepth: 33,
      shankLength: 42,
      shankDiameter: 15,
      shankSection: 'round',
      bend: 'eighth',
      stemLength: 250,
      stemStyle: 'taper',
    },
  },
  {
    id: 'egg',
    name: 'Яйцо',
    hint: 'Вытянутое яблоко: шире в нижней трети, кромка уже. Чаще с изгибом.',
    patch: {
      ...common,
      bowlHeight: 56,
      bowlDiameter: 40,
      cantDeg: 3,
      bowlProfile: 'egg',
      chamberDiameter: 18.5,
      chamberDepth: 42,
      shankLength: 48,
      shankDiameter: 17,
      shankSection: 'round',
      bend: 'quarter',
      stemLength: 66,
      stemStyle: 'taper',
    },
  },
  {
    id: 'brandy',
    name: 'Бренди',
    hint: 'Бокал: низ пузатый, кромка заметно уже. Обычно четверть изгиба.',
    patch: {
      ...common,
      bowlHeight: 46,
      bowlDiameter: 50,
      cantDeg: 2,
      bowlProfile: 'brandy',
      chamberDiameter: 21,
      chamberDepth: 34,
      shankLength: 42,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'quarter',
      stemLength: 64,
      stemStyle: 'taper',
    },
  },
  {
    id: 'zulu',
    name: 'Зулу',
    hint: 'Конус как у дублина, чаша завалена вперёд. Чубук прямой, гнётся только мундштук, шинка овальная.',
    patch: {
      ...common,
      bowlHeight: 48,
      bowlDiameter: 40,
      cantDeg: 10,
      bowlProfile: 'cone',
      chamberDiameter: 20,
      chamberDepth: 36,
      shankLength: 46,
      shankDiameter: 24,
      shankSection: 'oval',
      bend: 'eighth',
      stemLength: 70,
      stemStyle: 'taper',
    },
  },
  {
    id: 'oom-paul',
    name: 'Полный изгиб',
    hint: 'Чаша как у бильярда, но выше. Чубук круто задран, мундштук чаще седлом и почти горизонтален.',
    patch: {
      ...common,
      bowlHeight: 54,
      bowlDiameter: 40,
      cantDeg: 2,
      bowlProfile: 'cylinder',
      chamberDiameter: 20,
      chamberDepth: 42,
      shankLength: 38,
      shankDiameter: 18,
      shankSection: 'round',
      bend: 'full',
      stemLength: 56,
      stemStyle: 'saddle',
    },
  },
]

export function shapeById(id: string): ShapePreset {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0]
}

export function fillBlank(design: PipeDesign): PipeDesign {
  const next = ensureKnobs(design)
  if (next.blankLength > 0 && next.blankWidth > 0 && next.blankHeight > 0) return next
  return {
    ...next,
    blankLength: Math.ceil(next.bowlDiameter + next.shankLength + 16),
    blankWidth: Math.ceil(Math.max(next.bowlDiameter, next.shankDiameter) + 8),
    blankHeight: Math.ceil(next.bowlHeight + 8),
  }
}

export function designFromShape(shapeId: string, keep?: Partial<PipeDesign>): PipeDesign {
  const shape = shapeById(shapeId)
  return fillBlank({
    id: keep?.id || uid(),
    name: shape.name,
    shapeId: shape.id,
    woodId: keep?.woodId || 'briar',
    stemMaterial: keep?.stemMaterial || 'vulcanite',
    tenonStyle: keep?.tenonStyle || 'integral',
    finish: keep?.finish || 'smooth',
    grain: keep?.grain || 'plateau',
    blankLength: 0,
    blankWidth: 0,
    blankHeight: 0,
    ...shape.patch,
    ...derivedKnobs(shape.patch),
    chamberTaper: shape.patch.bowlProfile === 'cone',
  })
}

export function blankDesign(keep?: Partial<PipeDesign>): PipeDesign {
  return {
    id: keep?.id || uid(),
    name: 'Своя трубка',
    shapeId: 'custom',
    woodId: keep?.woodId || 'briar',
    stemMaterial: keep?.stemMaterial || 'vulcanite',
    tenonStyle: keep?.tenonStyle || 'integral',
    finish: keep?.finish || 'smooth',
    grain: keep?.grain || 'plateau',
    blankLength: 120,
    blankWidth: 48,
    blankHeight: 50,
    bowlHeight: 42,
    bowlDiameter: 36,
    cantDeg: 0,
    bowlProfile: 'cylinder',
    flatHeel: false,
    rings: 0,
    ...derivedKnobs({
      bowlHeight: 42,
      bowlDiameter: 36,
      bowlProfile: 'cylinder',
      flatHeel: false,
      rings: 0,
      shankSection: 'round',
    }),
    chamberTaper: false,
    chamberDiameter: 19,
    chamberDepth: 32,
    shankLength: 36,
    shankDiameter: 16,
    shankSection: 'round',
    bend: 'straight',
    stemLength: 62,
    stemStyle: 'taper',
    airwayDiameter: 4,
    mortiseDiameter: 7.9,
    mortiseDepth: 18,
    tenonGap: 1,
    slotDepth: 20,
    slotHeight: 1.4,
    buttonThickness: 4,
  }
}

export function bendLabel(bend: PipeDesign['bend']): string {
  switch (bend) {
    case 'straight':
      return 'прямая'
    case 'eighth':
      return '1/8'
    case 'quarter':
      return '1/4'
    case 'half':
      return '1/2'
    case 'threeQuarter':
      return '3/4'
    case 'full':
      return 'полный'
  }
}

export const BEND_ORDER: PipeDesign['bend'][] = [
  'straight',
  'eighth',
  'quarter',
  'half',
  'threeQuarter',
  'full',
]
