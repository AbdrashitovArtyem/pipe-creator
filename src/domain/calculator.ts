import type { PipeDesign } from './types'
import { nearestFraction } from './format'
import { innerRadiusAt, layoutPipe, sectionAt, type PipeLayout } from './geometry'

export interface Calc {
  layout: PipeLayout
  chamberVolumeMl: number
  airwayVolumeMl: number
  tobaccoLowG: number
  tobaccoHighG: number
  tenonWall: number
  tenonLength: number
  airwayLength: number
  block: { length: number; width: number; height: number }
  bits: { chamber: string; airway: string; mortise: string }
  openness: string
  cleanerOk: boolean
  cleanerNote: string
}

function integrateChamber(design: PipeDesign): number {
  const depth = design.chamberDepth
  const n = 48
  let vol = 0
  let prev = innerRadiusAt(design, 0)
  for (let i = 1; i <= n; i++) {
    const d = (depth * i) / n
    const r = innerRadiusAt(design, d)
    const h = depth / n
    vol += (Math.PI * h * (prev * prev + r * r)) / 2
    prev = r
  }
  return vol
}

function frustum(r1: number, r2: number, h: number): number {
  return (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3
}

export function calculate(design: PipeDesign): Calc {
  const layout = layoutPipe(design)
  const chamberVolume = integrateChamber(design)
  const airwayStart = layout.airway[0] ?? layout.chamberBottom
  const airwayEnd = layout.airway[layout.airway.length - 1] ?? layout.mortiseBottom
  const airwayLength = Math.hypot(airwayEnd.x - airwayStart.x, airwayEnd.y - airwayStart.y)
  const r = design.airwayDiameter / 2
  const stemBore = Math.max(0, design.stemLength - design.slotDepth)
  const taperLen = Math.min(12, design.slotDepth)
  const slotLen = Math.max(0, design.slotDepth - taperLen)
  const airwayVolume =
    Math.PI * r * r * (airwayLength + stemBore) +
    frustum(r, 0.75, taperLen) +
    design.slotHeight * Math.max(design.airwayDiameter, 4) * slotLen

  const tenonWall = (design.mortiseDiameter - design.airwayDiameter) / 2
  const tenonLength = Math.max(0, design.mortiseDepth - design.tenonGap)
  const sec = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio)
  let minX = layout.heel.x
  let maxX = layout.shankFace.x
  let minY = layout.heel.y
  let maxY = layout.rimCenter.y
  for (const p of layout.bowlOutline) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  for (const p of layout.centerline) {
    if (p.s < 0 || p.s > design.shankLength) continue
    minX = Math.min(minX, p.x - sec.rx)
    maxX = Math.max(maxX, p.x + sec.rx)
    minY = Math.min(minY, p.y - sec.ry)
    maxY = Math.max(maxY, p.y + sec.ry)
  }
  const block = {
    length: Math.max(0, maxX - minX) + 8,
    width: Math.max(design.bowlDiameter, design.shankDiameter) + 6,
    height: Math.max(0, maxY - minY) + 8,
  }

  const airwayFrac = nearestFraction(design.airwayDiameter)
  const mortiseFrac = nearestFraction(design.mortiseDiameter)
  const chamberFrac = nearestFraction(design.chamberDiameter)
  const bits = {
    chamber: `${design.chamberDiameter.toLocaleString('ru-RU')} мм${chamberFrac ? `, ${chamberFrac}` : ''}, скруглённое дно`,
    airway: `${design.airwayDiameter.toLocaleString('ru-RU')} мм${airwayFrac ? ` (${airwayFrac})` : ''}, один диаметр в шинке и цапфе`,
    mortise: `${design.mortiseDiameter.toLocaleString('ru-RU')} мм${mortiseFrac ? ` (${mortiseFrac})` : ''}, плоское дно`,
  }

  let openness: string
  if (design.airwayDiameter >= 4.2) {
    openness = 'Открытая тяга, ближе к широкому каналу Ньюкомба. Табак можно забивать плотнее, если захочется тише.'
  } else if (design.airwayDiameter >= 3.7) {
    openness = 'Обычный американский канал около 5/32″. Тягу сильнее испортит щель и прикус, чем эта цифра.'
  } else if (design.airwayDiameter >= 3.3) {
    openness = 'Сдержанная тяга, ближе к старым британским 9/64″. На большой чаше может казаться туго.'
  } else {
    openness = 'Узкий канал. На форумах такой размер чаще ругают: трубка греется и просит редкой забивки.'
  }
  if (design.slotDepth < 19) {
    openness += ' Щель короче 19 мм, прикус придётся делать толще, чем удобно.'
  }

  const cleanerOk = !layout.breakout && (design.bend === 'straight' || layout.bendRadius >= 20)
  const cleanerNote = cleanerOk
    ? 'Ёршик проходит: изгиб плавный, канал без ступеньки в стороне от оси.'
    : layout.breakout
      ? 'Канал выходит из тела шинки. Ёршик тут ни при чём — сначала поправь сверление.'
      : 'Радиус изгиба мал. Ёршик может встать на углу, оставь плавную дугу и не делай внутренний угол острым.'

  return {
    layout,
    chamberVolumeMl: chamberVolume / 1000,
    airwayVolumeMl: airwayVolume / 1000,
    tobaccoLowG: (chamberVolume / 1000) * 0.22,
    tobaccoHighG: (chamberVolume / 1000) * 0.3,
    tenonWall,
    tenonLength,
    airwayLength,
    block,
    bits,
    openness,
    cleanerOk,
    cleanerNote,
  }
}
