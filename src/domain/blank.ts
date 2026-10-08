import type { PipeDesign, ShankSection } from './types'
import { clamp } from './format'
import { sectionAt } from './geometry'
import { ensureKnobs } from './shapes'
import { woodById } from './woods'

/** Дерево между гнездом и наружной шинкой. */
export const SHANK_WALL = 3.2
/** Дерево цапфы между каналом и гнездом. */
export const TENON_WALL = 1.6

export interface Range {
  min: number
  max: number
}

export interface SizeLimits {
  blankLength: Range
  blankWidth: Range
  blankHeight: Range
  bowlHeight: Range
  bowlDiameter: Range
  chamberDiameter: Range
  chamberDepth: Range
  shankDiameter: Range
  shankLength: Range
  airwayDiameter: Range
  mortiseDiameter: Range
  mortiseDepth: Range
}

/** Доля номинального диаметра, которая остаётся в самом узком месте сечения. */
export function sectionFactor(section: ShankSection, ovalRatio = 0.62): number {
  const sample = sectionAt(section, 10, ovalRatio)
  return (Math.min(sample.rx, sample.ry) * 2) / 10
}

function span(min: number, max: number): Range {
  const lo = Math.ceil(min * 10 - 1e-6) / 10
  const hi = Math.floor(max * 10 + 1e-6) / 10
  if (hi < lo) return { min: hi, max: hi }
  return { min: lo, max: hi }
}

export const BLANK_RANGE = {
  length: { min: 40, max: 600 },
  width: { min: 24, max: 250 },
  height: { min: 24, max: 250 },
}

/**
 * Брусок вводится свободно. Минимум чаши и шинки — от каналов.
 * Максимум чаши, шинки и каналов — от уже введённого бруска.
 */
export function sizeLimits(design: PipeDesign): SizeLimits {
  const wall = woodById(design.woodId).minWall
  const factor = sectionFactor(design.shankSection, design.ovalRatio)
  const minBowlD = design.chamberDiameter + 2 * wall
  const minBowlH = design.chamberDepth + wall
  const minShankD = (design.mortiseDiameter + 2 * SHANK_WALL) / factor
  const minShankL = design.mortiseDepth + 4
  const maxShankL = Math.max(0, design.blankLength - design.bowlDiameter)
  return {
    blankLength: BLANK_RANGE.length,
    blankWidth: BLANK_RANGE.width,
    blankHeight: BLANK_RANGE.height,
    bowlHeight: span(minBowlH, design.blankHeight),
    bowlDiameter: span(minBowlD, design.blankWidth),
    chamberDiameter: span(8, Math.min(40, design.blankWidth - 2 * wall)),
    chamberDepth: span(12, Math.min(80, design.blankHeight - wall)),
    shankDiameter: span(minShankD, Math.min(design.blankWidth, design.blankHeight)),
    shankLength: span(minShankL, Math.max(minShankL, maxShankL)),
    airwayDiameter: { min: 2.4, max: 6 },
    mortiseDiameter: span(design.airwayDiameter + 2 * TENON_WALL, 16),
    mortiseDepth: span(8, Math.max(8, maxShankL - 4)),
  }
}

/** Брусок остаётся как ввели. Чаша, шинка и каналы ужимаются в него, а не раздувают кусок. */
export function applyBlank(design: PipeDesign): PipeDesign {
  const next = ensureKnobs(design)
  next.heelMm = clamp(next.heelMm, 0, 40)
  next.heelLeave = clamp(next.heelLeave, 0.2, 0.9)
  next.peakAt = clamp(next.peakAt, 0.2, 1)
  next.rimFactor = clamp(next.rimFactor, 0.7, 1)
  next.footFactor = clamp(next.footFactor, 0.35, 1)
  next.shankTaper = clamp(next.shankTaper, 0, 0.28)
  next.ovalRatio = clamp(next.ovalRatio, 0.5, 1)
  if (next.rings !== 1 && next.rings !== 2) next.rings = 0
  const wall = woodById(next.woodId).minWall
  const factor = sectionFactor(next.shankSection, next.ovalRatio)
  const shoulder = 4

  next.blankLength = clamp(next.blankLength, BLANK_RANGE.length.min, BLANK_RANGE.length.max)
  next.blankWidth = clamp(next.blankWidth, BLANK_RANGE.width.min, BLANK_RANGE.width.max)
  next.blankHeight = clamp(next.blankHeight, BLANK_RANGE.height.min, BLANK_RANGE.height.max)

  const maxBowlH = next.blankHeight
  const maxBowlD = next.blankWidth
  const maxShankD = Math.min(next.blankWidth, next.blankHeight)

  next.airwayDiameter = clamp(next.airwayDiameter, 2.4, 6)
  const mortiseFloor = next.airwayDiameter + 2 * TENON_WALL
  const mortiseCeil = Math.max(mortiseFloor, Math.min(16, maxShankD * factor - 2 * SHANK_WALL))
  next.mortiseDiameter = clamp(next.mortiseDiameter, mortiseFloor, mortiseCeil)
  next.airwayDiameter = Math.min(next.airwayDiameter, Math.max(2.4, next.mortiseDiameter - 2 * TENON_WALL))

  next.chamberDiameter = clamp(next.chamberDiameter, 8, Math.max(8, Math.min(40, maxBowlD - 2 * wall)))
  next.chamberDepth = clamp(next.chamberDepth, 12, Math.max(12, Math.min(80, maxBowlH - wall)))

  const minBowlD = next.chamberDiameter + 2 * wall
  const minBowlH = next.chamberDepth + wall
  const minShankD = (next.mortiseDiameter + 2 * SHANK_WALL) / factor
  next.bowlDiameter = clamp(next.bowlDiameter, Math.min(minBowlD, maxBowlD), maxBowlD)
  next.bowlHeight = clamp(next.bowlHeight, Math.min(minBowlH, maxBowlH), maxBowlH)
  next.shankDiameter = clamp(next.shankDiameter, Math.min(minShankD, maxShankD), maxShankD)

  if (next.bowlDiameter + 0.05 < minBowlD) next.chamberDiameter = Math.max(8, next.bowlDiameter - 2 * wall)
  if (next.bowlHeight + 0.05 < minBowlH) next.chamberDepth = Math.max(12, next.bowlHeight - wall)
  if (next.shankDiameter * factor + 0.05 < next.mortiseDiameter + 2 * SHANK_WALL) {
    next.mortiseDiameter = Math.max(mortiseFloor, next.shankDiameter * factor - 2 * SHANK_WALL)
    next.airwayDiameter = Math.min(next.airwayDiameter, Math.max(2.4, next.mortiseDiameter - 2 * TENON_WALL))
  }

  const maxShankL = Math.max(0, next.blankLength - next.bowlDiameter)
  next.mortiseDepth = clamp(next.mortiseDepth, 8, Math.max(8, maxShankL - shoulder))
  const minShankL = Math.min(next.mortiseDepth + shoulder, maxShankL)
  next.shankLength = clamp(next.shankLength, minShankL, Math.max(minShankL, maxShankL))
  next.mortiseDepth = clamp(next.mortiseDepth, 8, Math.max(8, next.shankLength - shoulder))
  return next
}
