import type { PipeDesign } from '../domain/types'
import type { Calc } from '../domain/calculator'
import { centerlineFrom, joinBand, outerRadiusAt, seatOnSole, sectionAt, shankScaleAt, toWorld, type PipeLayout } from '../domain/geometry'

function n(v: number): string {
  return v.toFixed(2)
}

function poly(points: string): string {
  return `<polygon points="${points}" fill="#f4e6d4" stroke="#1c1917" stroke-width="0.35"/>`
}

function line(x1: number, y1: number, x2: number, y2: number, extra = '', stroke = '#1c1917'): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="0.25" ${extra}/>`
}

function text(x: number, y: number, value: string, size = 3.2): string {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-family="sans-serif" fill="#1c1917">${value}</text>`
}

function dim(x1: number, y1: number, x2: number, y2: number, label: string): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return `${line(x1, y1, x2, y2)}${text(mx + 1.2, my - 0.8, label)}`
}

export function buildTemplateSvg(design: PipeDesign, calc: Calc): string {
  const L = calc.layout
  const side = sideView(design, L)
  const top = topView(design)
  const face = shankFace(design)
  const rim = rimFace(design)
  const gap = 16
  const width = Math.max(side.w, top.w, 160) + 24
  const height = 12 + side.h + gap + top.h + gap + Math.max(face.h, rim.h) + 22
  let y = 10
  const parts = [
    text(8, y, `${design.name} · развёртка 1:1 · печатать без масштабирования`, 4),
    text(8, y + 5, `Брусок ${design.blankLength}×${design.blankWidth}×${design.blankHeight} мм. Мундштук — отдельный пруток. Приложить лист к дереву и перенести линии.`, 3),
  ]
  y += 12
  parts.push(`<g transform="translate(8 ${n(y)})">${side.body}</g>`)
  y += side.h + gap
  parts.push(`<g transform="translate(8 ${n(y)})">${top.body}</g>`)
  y += top.h + gap
  parts.push(`<g transform="translate(8 ${n(y)})">${rim.body}</g>`)
  parts.push(`<g transform="translate(${n(rim.w + 18)} ${n(y)})">${face.body}</g>`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" viewBox="0 0 ${n(width)} ${n(height)}">
  <rect width="100%" height="100%" fill="#fffaf3"/>
  ${parts.join('\n  ')}
</svg>`
}

function sideView(design: PipeDesign, L: PipeLayout): { w: number; h: number; body: string } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of [...L.bowlOutline, ...L.centerline.filter((c) => c.s <= design.shankLength)]) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const pad = 14
  const map = (p: { x: number; y: number }) => `${n(p.x - minX + pad)},${n(maxY - p.y + pad)}`
  const bowl = L.bowlOutline.map(map).join(' ')
  const ryAt = (s: number) => sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio).ry * shankScaleAt(design, s)
  const shankLine = centerlineFrom(L.centerline, -design.bowlDiameter - 12)
  const shankPts = shankLine.filter((p) => p.s >= -design.bowlDiameter - 0.2 && p.s <= design.shankLength + 0.2)
  const rawUpper = shankPts.map((p) => ({ x: p.x - p.ty * ryAt(p.s), y: p.y + p.tx * ryAt(p.s) }))
  const rawLower = shankPts.map((p) => ({ x: p.x + p.ty * ryAt(p.s), y: p.y - p.tx * ryAt(p.s) }))
  const band = joinBand(rawUpper, seatOnSole(rawLower, design, L.sit), L.bowlOutline)
  const upper = band.upper.map(map)
  const lower = [...band.lower].reverse().map(map)
  const bridge = band.bridge.slice(1, -1).map(map)
  const chamber: string[] = []
  for (let i = 0; i <= 16; i++) {
    const s = design.bowlHeight - (Math.min(design.chamberDepth, design.bowlHeight) * i) / 16
    chamber.push(map(toWorld(-design.chamberDiameter / 2, s, design.cantDeg, L.sit)))
  }
  for (let i = 16; i >= 0; i--) {
    const s = design.bowlHeight - (Math.min(design.chamberDepth, design.bowlHeight) * i) / 16
    chamber.push(map(toWorld(design.chamberDiameter / 2, s, design.cantDeg, L.sit)))
  }
  const airway = L.airway.map(map).join(' ')
  const w = maxX - minX + pad * 2 + 28
  const h = maxY - minY + pad * 2 + 16
  const body = [
    text(0, 4, 'Вид сбоку. Сплошная линия — наружный контур, пунктир — камера и канал.'),
    poly(bowl),
    poly([...upper, ...lower, ...bridge].join(' ')),
    `<polygon points="${chamber.join(' ')}" fill="none" stroke="#9a3412" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`,
    `<polyline points="${airway}" fill="none" stroke="#9a3412" stroke-width="0.35" stroke-dasharray="0.4 0.7"/>`,
    dim(pad + L.heel.x - minX, h - 8, pad + L.shankFace.x - minX, h - 8, `до торца шинки ${Math.round(L.shankFace.x - L.heel.x)} мм`),
    dim(4, pad + (maxY - L.rimCenter.y), 4, pad + (maxY - L.heel.y), `H ${Math.round(design.bowlHeight)}`),
    text(pad, h - 1, `Камера ⌀ ${design.chamberDiameter} × ${design.chamberDepth} мм. Шинка ⌀ ${design.shankDiameter} × ${design.shankLength} мм. Угол к чаше ${L.shankAngleDeg.toFixed(0)}°.`),
  ].join('')
  return { w, h, body }
}

function topView(design: PipeDesign): { w: number; h: number; body: string } {
  const d = design.bowlDiameter
  const r = d / 2
  const cr = design.chamberDiameter / 2
  const shank = design.shankLength
  const sr = design.shankDiameter / 2
  const ox = 20
  const oy = 18 + r
  const w = ox + d + shank + 36
  const h = d + 28
  const body = [
    text(0, 4, 'Вид сверху. Кольцо между контуром и камерой — стенка.'),
    `<circle cx="${n(ox + r)}" cy="${n(oy)}" r="${n(r)}" fill="#f4e6d4" stroke="#1c1917" stroke-width="0.35"/>`,
    `<circle cx="${n(ox + r)}" cy="${n(oy)}" r="${n(cr)}" fill="none" stroke="#9a3412" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`,
    `<rect x="${n(ox + d)}" y="${n(oy - sr)}" width="${n(shank)}" height="${n(design.shankDiameter)}" fill="#f4e6d4" stroke="#1c1917" stroke-width="0.35"/>`,
    line(ox + r, oy, ox + d + shank, oy, 'stroke-dasharray="0.5 0.7"', '#9a3412'),
    text(ox, h - 2, `Чаша ⌀ ${d} мм, камера ⌀ ${design.chamberDiameter} мм, стенка у кромки ${Math.max(0, outerRadiusAt(design, design.bowlHeight) - cr).toFixed(1)} мм.`),
  ].join('')
  return { w, h, body }
}

function shankFace(design: PipeDesign): { w: number; h: number; body: string } {
  const r = design.shankDiameter / 2
  const mr = design.mortiseDiameter / 2
  const ar = design.airwayDiameter / 2
  const c = r + 8
  const w = design.shankDiameter + 28
  const h = design.shankDiameter + 22
  const body = [
    text(0, 4, 'Торец шинки'),
    `<circle cx="${n(c)}" cy="${n(c + 4)}" r="${n(r)}" fill="#f4e6d4" stroke="#1c1917" stroke-width="0.35"/>`,
    `<circle cx="${n(c)}" cy="${n(c + 4)}" r="${n(mr)}" fill="none" stroke="#9a3412" stroke-width="0.3"/>`,
    `<circle cx="${n(c)}" cy="${n(c + 4)}" r="${n(ar)}" fill="none" stroke="#9a3412" stroke-width="0.35" stroke-dasharray="0.4 0.6"/>`,
    text(0, h - 2, `Гнездо ⌀ ${design.mortiseDiameter} × ${design.mortiseDepth} мм, канал ⌀ ${design.airwayDiameter} мм.`),
  ].join('')
  return { w, h, body }
}

function rimFace(design: PipeDesign): { w: number; h: number; body: string } {
  const r = design.bowlDiameter / 2
  const cr = design.chamberDiameter / 2
  const c = r + 8
  const w = design.bowlDiameter + 24
  const h = design.bowlDiameter + 22
  const body = [
    text(0, 4, 'Кромка чаши'),
    `<circle cx="${n(c)}" cy="${n(c + 4)}" r="${n(r)}" fill="#f4e6d4" stroke="#1c1917" stroke-width="0.35"/>`,
    `<circle cx="${n(c)}" cy="${n(c + 4)}" r="${n(cr)}" fill="none" stroke="#9a3412" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`,
    text(0, h - 2, `Сверлить камеру по центру, глубина ${design.chamberDepth} мм, до канала не доходить 3 мм.`),
  ].join('')
  return { w, h, body }
}

export function downloadTemplate(design: PipeDesign, calc: Calc) {
  const blob = new Blob([buildTemplateSvg(design, calc)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${design.name.replace(/\s+/g, '-')}-razvertka.svg`
  a.click()
  URL.revokeObjectURL(url)
}
