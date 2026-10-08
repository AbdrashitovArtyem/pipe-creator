export type BowlProfile = 'cylinder' | 'cone' | 'apple' | 'egg' | 'brandy'
export type ShankSection = 'round' | 'oval' | 'diamond' | 'square'
export type Bend = 'straight' | 'eighth' | 'quarter' | 'half' | 'threeQuarter' | 'full'
export type StemStyle = 'taper' | 'saddle'
export type TenonStyle = 'integral' | 'delrin'
export type StemMaterial = 'vulcanite' | 'acrylic' | 'cumberland'
export type Finish = 'smooth' | 'sandblast' | 'rusticated'
export type Grain = 'plateau' | 'ebauchon'
export type Units = 'mm' | 'in'
export type PartId =
  | 'bowl'
  | 'chamber'
  | 'airway'
  | 'shank'
  | 'mortise'
  | 'tenon'
  | 'stem'
  | 'button'
  | 'slot'

export interface PipeDesign {
  id: string
  name: string
  shapeId: string
  woodId: string
  bowlHeight: number
  bowlDiameter: number
  cantDeg: number
  bowlProfile: BowlProfile
  flatHeel: boolean
  rings: 0 | 1 | 2
  /** Высота скругления пятки, мм. 0 — плоский срез. */
  heelMm: number
  /** Насколько плавно стенка переходит в дно. Меньше — резче. */
  heelLeave: number
  /** Доля высоты, где чаша шире всего. 1 — у кромки. */
  peakAt: number
  /** Кромка как доля самого широкого диаметра. */
  rimFactor: number
  /** Низ стенки как доля диаметра, над пяткой. */
  footFactor: number
  /** Насколько чубук толще у чаши, чем у торца. 0 — ровный. */
  shankTaper: number
  /** Высота овальной шинки как доля ширины. */
  ovalRatio: number
  /** Камера сужается к дну, как у дублина. */
  chamberTaper: boolean
  chamberDiameter: number
  chamberDepth: number
  shankLength: number
  shankDiameter: number
  shankSection: ShankSection
  bend: Bend
  stemLength: number
  stemStyle: StemStyle
  stemMaterial: StemMaterial
  tenonStyle: TenonStyle
  airwayDiameter: number
  mortiseDiameter: number
  mortiseDepth: number
  tenonGap: number
  slotDepth: number
  slotHeight: number
  buttonThickness: number
  blankLength: number
  blankWidth: number
  blankHeight: number
  finish: Finish
  grain: Grain
}

export interface Vec2 {
  x: number
  y: number
}

export const PARTS: { id: PartId; title: string }[] = [
  { id: 'bowl', title: 'Чаша' },
  { id: 'chamber', title: 'Камера' },
  { id: 'airway', title: 'Дымовой канал' },
  { id: 'shank', title: 'Шинка' },
  { id: 'mortise', title: 'Гнездо' },
  { id: 'tenon', title: 'Цапфа' },
  { id: 'stem', title: 'Мундштук' },
  { id: 'button', title: 'Прикус' },
  { id: 'slot', title: 'Щель' },
]
