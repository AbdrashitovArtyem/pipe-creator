export type ChamberBit = 'none' | 'spade' | 'spoon' | 'burr'
export type MortiseBit = 'forstner' | 'brad' | 'endmill'
export type TenonTool = 'none' | 'pimo' | 'lathe'

export interface ToolInventory {
  kit: boolean
  handDrill: boolean
  drillPress: boolean
  lathe: boolean
  bandsaw: boolean
  copingSaw: boolean
  chamberBit: ChamberBit
  mortiseBit: MortiseBit
  airwayBits: number[]
  discSander: boolean
  files: boolean
  buffer: boolean
  tenonTool: TenonTool
  dremel: boolean
  calipers: boolean
  sandblaster: boolean
}

export const defaultTools = (): ToolInventory => ({
  kit: false,
  handDrill: true,
  drillPress: true,
  lathe: false,
  bandsaw: false,
  copingSaw: true,
  chamberBit: 'spade',
  mortiseBit: 'forstner',
  airwayBits: [4],
  discSander: false,
  files: true,
  buffer: false,
  tenonTool: 'pimo',
  dremel: true,
  calipers: true,
  sandblaster: false,
})

export const AIRWAY_BIT_OPTIONS = [3.2, 3.5, 4, 4.3]

export interface ToolField {
  key: keyof ToolInventory
  label: string
  hint: string
  kind: 'bool'
}

export const TOOL_FIELDS: { key: keyof ToolInventory; label: string; hint: string }[] = [
  { key: 'kit', label: 'Набор с готовыми отверстиями', hint: 'Брусок уже просверлен, цапфа подогнана' },
  { key: 'handDrill', label: 'Ручная дрель', hint: 'Нужна и как дополнение к станку' },
  { key: 'drillPress', label: 'Сверлильный станок', hint: 'Отверстия первыми, привычный любительский порядок' },
  { key: 'lathe', label: 'Токарный станок', hint: 'Чаша и шинка на токарном' },
  { key: 'bandsaw', label: 'Ленточная пила', hint: 'Грубый срез бруска' },
  { key: 'copingSaw', label: 'Лобзик', hint: 'Если ленты нет' },
  { key: 'discSander', label: 'Дисковая шлифовка', hint: 'Быстрый вывод круглой формы' },
  { key: 'files', label: 'Напильники и рашпили', hint: 'В том числе круглый напильник по стыку чаши и шинки' },
  { key: 'buffer', label: 'Полировальные круги', hint: 'Триполи и отдельный круг под воск' },
  { key: 'dremel', label: 'Бормашина', hint: 'Щель и мелкая доводка' },
  { key: 'calipers', label: 'Штангенциркуль', hint: 'Стенка, цапфа, диаметры' },
  { key: 'sandblaster', label: 'Пескоструй', hint: 'Только если отделка — пескоструй' },
]
