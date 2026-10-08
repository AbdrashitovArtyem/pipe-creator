import { calculate } from './calculator'
import { designFromShape } from './shapes'
import { layoutPipe } from './geometry'

export function runSelfCheck(): string[] {
  const errors: string[] = []
  const billiard = designFromShape('billiard')
  const calc = calculate(billiard)
  const L = calc.layout
  if (calc.chamberVolumeMl < 8 || calc.chamberVolumeMl > 16) {
    errors.push(`объём бильярда ${calc.chamberVolumeMl.toFixed(2)} мл`)
  }
  if (L.aimError > 1.2) errors.push(`промах прямой ${L.aimError.toFixed(2)}`)
  if (L.minSideWall < 6) errors.push(`стенка ${L.minSideWall.toFixed(2)}`)
  if (L.heelWall < 6) errors.push(`пятка ${L.heelWall.toFixed(2)}`)
  if (L.breakout) errors.push('прорыв на прямой')
  if (Math.abs(L.drillAngleDeg) > 8) errors.push(`угол прямой ${L.drillAngleDeg.toFixed(1)}`)

  const church = designFromShape('churchwarden')
  if (church.stemLength < 230) errors.push('черчварден короткий')
  const canadian = designFromShape('canadian')
  if (canadian.shankLength < canadian.bowlHeight * 1.5) errors.push('канадец короткая шинка')
  const liverpool = designFromShape('liverpool')
  if (liverpool.shankLength < liverpool.bowlHeight * 2) errors.push('ливерпуль')

  const oom = calculate(designFromShape('oom-paul'))
  if (oom.layout.shankAngleDeg < 22 || oom.layout.shankAngleDeg > 36) {
    errors.push(`угол полного изгиба ${oom.layout.shankAngleDeg.toFixed(1)}`)
  }
  if (L.shankAngleDeg < 85) errors.push(`угол бильярда ${L.shankAngleDeg.toFixed(1)}`)

  const dublin = layoutPipe(designFromShape('dublin'))
  if (dublin.rimWall < 5) errors.push(`кромка дублина ${dublin.rimWall.toFixed(2)}`)

  for (const id of ['billiard', 'apple', 'pot', 'poker', 'chimney', 'bulldog', 'prince', 'zulu', 'brandy', 'egg']) {
    const c = calculate(designFromShape(id))
    if (!Number.isFinite(c.chamberVolumeMl) || c.chamberVolumeMl <= 0) errors.push(`объём ${id}`)
    if (!Number.isFinite(c.layout.bounds.maxX)) errors.push(`габарит ${id}`)
  }
  return errors
}
