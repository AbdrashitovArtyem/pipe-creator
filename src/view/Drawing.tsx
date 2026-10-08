import { useRef } from 'react'
import type { PipeDesign, Units, Vec2 } from '../domain/types'
import type { Calc } from '../domain/calculator'
import { formatLen } from '../domain/format'
import {
  centerlineFrom,
  diamondSole,
  innerRadiusAt,
  joinBand,
  outerRadiusAt,
  seatOnSole,
  sectionAt,
  shankScaleAt,
  stemSection,
  toWorld,
  type PathPoint,
} from '../domain/geometry'
import { woodById } from '../domain/woods'
import { downloadTemplate } from './templateSvg'

interface Props {
  design: PipeDesign
  calc: Calc
  units: Units
}

export function Drawing({ design, calc, units }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const L = calc.layout
  const pad = 16
  const minX = Math.min(L.bounds.minX, L.heel.x - design.bowlDiameter / 2) - pad
  const maxX = L.bounds.maxX + pad
  const maxY = L.bounds.maxY + 14
  const minY = Math.min(L.bounds.minY, 0) - 8
  const spanX = maxX - minX
  const spanY = maxY - minY
  const drawW = 900
  const drawH = 230
  const scale = Math.min(drawW / spanX, drawH / spanY)
  const ox = 48 - minX * scale
  const above = maxY * scale
  const below = -minY * scale

  const sideOy = 56 + above
  const sectionOy = sideOy + below + 44 + above
  const topOy = sectionOy + below + design.bowlDiameter * scale * 0.62 + 36
  const svgH = topOy + design.bowlDiameter * scale * 0.62 + 64

  const sideMap = mapper(ox, sideOy, scale)
  const sectionMap = mapper(ox, sectionOy, scale)
  const topScale = scale
  const topMap = (p: Vec2) => `${(ox + p.x * topScale).toFixed(1)},${(topOy - p.y * topScale).toFixed(1)}`
  const topMapX = (p: Vec2) => ox + p.x * topScale
  const topMapY = (p: Vec2) => topOy - p.y * topScale

  const shankRy = (s: number) => sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio).ry * shankScaleAt(design, s)
  const stemRy = (s: number) => stemSection(design, (s - design.shankLength) / Math.max(1, design.stemLength)).ry
  const shankLine = centerlineFrom(L.centerline, -design.bowlDiameter - 12)
  const shankRaw = ribbon(shankLine, -design.bowlDiameter, design.shankLength, shankRy)
  const shank = joinBand(shankRaw.upper, seatOnSole(shankRaw.lower, design, L.sit), L.bowlOutline)
  const stemRaw = ribbon(L.centerline, design.shankLength, design.shankLength + design.stemLength, stemRy)
  const stem = { upper: stemRaw.upper, lower: seatOnSole(stemRaw.lower, design, L.sit), bridge: [] as Vec2[] }
  const chamber = chamberLoop(design, L.sit)
  const airway = capsule(L.airway, design.airwayDiameter / 2)
  const mortise = capsule([{ x: L.shankFace.x, y: L.shankFace.y }, L.mortiseBottom], design.mortiseDiameter / 2)
  const top = buildTop(design, L.centerline, L.sit)

  function download() {
    const node = ref.current
    if (!node) return
    const blob = new Blob([new XMLSerializer().serializeToString(node)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${design.name.replace(/\s+/g, '-')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sheet">
      <div className="sheet-actions">
        <button type="button" onClick={download}>
          Скачать SVG
        </button>
        <button type="button" onClick={() => downloadTemplate(design, calc)}>
          Развёртка 1:1
        </button>
        <button type="button" onClick={() => window.print()}>
          Печать
        </button>
      </div>
      <svg ref={ref} className="drawing" viewBox={`0 0 1000 ${Math.ceil(svgH)}`} role="img" aria-label="Чертёж трубки">
        <rect width="1000" height={svgH} fill="#f6f1e7" />
        <text x="48" y="28" className="draw-title">
          {design.name} · {woodById(design.woodId).name}
        </text>
        <text x="48" y="46" className="draw-note">
          Вид сбоку
        </text>
        <Silhouette map={sideMap} bowl={L.bowlOutline} shank={shank} stem={stem} />
        <Dim
          x1={ox + Math.min(L.heel.x, L.bounds.minX) * scale}
          y1={sideOy + below + 16}
          x2={ox + L.mouth.x * scale}
          y2={sideOy + below + 16}
          label={`длина ${formatLen(L.mouth.x - Math.min(L.heel.x, L.bounds.minX), units, 0)}`}
        />
        <Dim
          x1={ox + (L.rimCenter.x - design.bowlDiameter / 2 - 6) * scale}
          y1={sideOy - L.heel.y * scale}
          x2={ox + (L.rimCenter.x - design.bowlDiameter / 2 - 6) * scale}
          y2={sideOy - L.rimCenter.y * scale}
          label={formatLen(design.bowlHeight, units, 0)}
        />

        <text x="48" y={sectionOy - maxY * scale - 10} className="draw-note">
          Разрез по дымовому каналу
        </text>
        <Silhouette map={sectionMap} bowl={L.bowlOutline} shank={shank} stem={stem} />
        <polygon points={chamber.map(sectionMap).join(' ')} className="void" />
        <polygon points={airway.map(sectionMap).join(' ')} className="void" />
        <polygon points={mortise.map(sectionMap).join(' ')} className="void" />
        <polygon points={slotVoid(design, L.mouth).map(sectionMap).join(' ')} className="void" />
        <text x={ox + L.rimCenter.x * scale + 8} y={sectionOy - L.rimCenter.y * scale} className="draw-note">
          {`камера ⌀ ${formatLen(design.chamberDiameter, units)} × ${formatLen(design.chamberDepth, units, 0)}`}
        </text>
        <text x={ox + ((L.chamberBottom.x + L.mortiseBottom.x) / 2) * scale} y={sectionOy - L.chamberBottom.y * scale + 18} className="draw-note">
          {`канал ⌀ ${formatLen(design.airwayDiameter, units)} · к чаше ${L.shankAngleDeg.toFixed(0)}° · длина ${formatLen(calc.airwayLength, units, 0)}`}
        </text>
        <text x={ox + L.shankFace.x * scale - 8} y={sectionOy - L.shankFace.y * scale - 12} className="draw-note">
          {`гнездо ⌀ ${formatLen(design.mortiseDiameter, units)} × ${formatLen(design.mortiseDepth, units, 0)}`}
        </text>

        <text x="48" y={topOy - design.bowlDiameter * topScale * 0.55 - 8} className="draw-note">
          Вид сверху · кольцо между контуром и камерой это стенка
        </text>
        <polygon points={top.bowl.map(topMap).join(' ')} className="wood" />
        <polygon points={top.shank.map(topMap).join(' ')} className="wood" />
        <polygon points={top.stem.map(topMap).join(' ')} className="stem" />
        <polygon points={top.chamber.map(topMap).join(' ')} className="void" />
        <Dim
          x1={topMapX(top.wallInner)}
          y1={topMapY(top.wallInner)}
          x2={topMapX(top.wallOuter)}
          y2={topMapY(top.wallOuter)}
          label={`стенка ${formatLen(L.rimWall, units)}`}
        />
        <text x="48" y={svgH - 28} className="draw-note">
          {`Брусок ${Math.ceil(calc.block.length)} × ${Math.ceil(calc.block.width)} × ${Math.ceil(calc.block.height)} мм. Щель ${formatLen(design.slotDepth, units, 0)} × ${formatLen(design.slotHeight, units)}. Прикус ${formatLen(design.buttonThickness, units)}. Зазор цапфы ${formatLen(design.tenonGap, units)}.`}
        </text>
        <text x="48" y={svgH - 12} className="draw-note">
          Чубук и канал на одной оси. Ось касается скругления дна и выходит по наружному профилю чаши.
        </text>
      </svg>
    </div>
  )
}

function mapper(ox: number, oy: number, scale: number) {
  return (p: Vec2) => `${(ox + p.x * scale).toFixed(1)},${(oy - p.y * scale).toFixed(1)}`
}

function Silhouette({
  map,
  bowl,
  shank,
  stem,
}: {
  map: (p: Vec2) => string
  bowl: Vec2[]
  shank: { upper: Vec2[]; lower: Vec2[]; bridge: Vec2[] }
  stem: { upper: Vec2[]; lower: Vec2[]; bridge: Vec2[] }
}) {
  return (
    <g>
      <polygon points={bowl.map(map).join(' ')} className="wood" />
      <polygon points={closed(shank, map)} className="wood" />
      <polygon points={closed(stem, map)} className="stem" />
    </g>
  )
}

function ribbon(centerline: PathPoint[], from: number, to: number, ryAt: (s: number) => number) {
  const pts = centerline.filter((p) => p.s >= from - 0.2 && p.s <= to + 0.2)
  const upper: Vec2[] = []
  const lower: Vec2[] = []
  for (const p of pts) {
    const ry = ryAt(p.s)
    upper.push({ x: p.x - p.ty * ry, y: p.y + p.tx * ry })
    lower.push({ x: p.x + p.ty * ry, y: p.y - p.tx * ry })
  }
  return { upper, lower }
}

function closed(band: { upper: Vec2[]; lower: Vec2[]; bridge?: Vec2[] }, map: (p: Vec2) => string) {
  const bridge = band.bridge ?? []
  return [...band.upper, ...[...band.lower].reverse(), ...bridge.slice(1, -1)].map(map).join(' ')
}

function chamberLoop(design: PipeDesign, sit: number): Vec2[] {
  const depth = Math.min(design.chamberDepth, design.bowlHeight)
  const left: Vec2[] = []
  const right: Vec2[] = []
  for (let i = 0; i <= 28; i++) {
    const dist = (depth * i) / 28
    const r = innerRadiusAt(design, dist)
    const s = design.bowlHeight - dist
    left.push(toWorld(-r, s, design.cantDeg, sit))
    right.push(toWorld(r, s, design.cantDeg, sit))
  }
  return [...left, ...right.reverse()]
}

function slotVoid(design: PipeDesign, mouth: { x: number; y: number; tx: number; ty: number }): Vec2[] {
  const end = { x: mouth.x - mouth.tx * design.slotDepth, y: mouth.y - mouth.ty * design.slotDepth }
  return capsule([mouth, end], design.slotHeight / 2)
}

function capsule(pts: Vec2[], r: number): Vec2[] {
  if (pts.length < 2) return []
  const upper: Vec2[] = []
  const lower: Vec2[] = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(pts.length - 1, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    upper.push({ x: pts[i].x - ty * r, y: pts[i].y + tx * r })
    lower.push({ x: pts[i].x + ty * r, y: pts[i].y - tx * r })
  }
  return [...upper, ...lower.reverse()]
}

function buildTop(design: PipeDesign, centerline: PathPoint[], sit: number) {
  const bowlL: Vec2[] = []
  const bowlR: Vec2[] = []
  const s0 = diamondSole(design)
  const H = design.bowlHeight
  for (let i = 0; i <= 24; i++) {
    const s = s0 + ((H - s0) * i) / 24
    const r = outerRadiusAt(design, s)
    const axis = toWorld(0, s, design.cantDeg, sit)
    bowlL.push({ x: axis.x, y: -r })
    bowlR.push({ x: axis.x, y: r })
  }
  const band = (from: number, to: number, rxAt: (s: number) => number, line: PathPoint[]) => {
    const pts = line.filter((p) => p.s >= from - 0.2 && p.s <= to + 0.2)
    const upper = pts.map((p) => ({ x: p.x, y: rxAt(p.s) }))
    const lower = pts.map((p) => ({ x: p.x, y: -rxAt(p.s) }))
    return [...upper, ...lower.reverse()]
  }
  const shankRx = (s: number) => sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio).rx * shankScaleAt(design, s)
  const stemRx = (s: number) => stemSection(design, (s - design.shankLength) / Math.max(1, design.stemLength)).rx
  const axis = centerlineFrom(centerline, -design.bowlDiameter - 12)
  const bowl = [...bowlL, ...[...bowlR].reverse()]
  const rim = toWorld(0, design.bowlHeight, design.cantDeg, sit)
  const inner = design.chamberDiameter / 2
  const outer = outerRadiusAt(design, design.bowlHeight)
  const chamber: Vec2[] = []
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2
    chamber.push({ x: rim.x + Math.cos(a) * inner, y: Math.sin(a) * inner })
  }
  const shankPts = axis.filter((p) => p.s >= -design.bowlDiameter - 0.2 && p.s <= design.shankLength + 0.2)
  const shankUpper = shankPts.map((p) => ({ x: p.x, y: shankRx(p.s) }))
  const shankLower = shankPts.map((p) => ({ x: p.x, y: -shankRx(p.s) }))
  const shankBand = joinBand(shankUpper, shankLower, bowl)
  return {
    bowl,
    shank: [...shankBand.upper, ...[...shankBand.lower].reverse(), ...shankBand.bridge.slice(1, -1)],
    stem: band(design.shankLength, design.shankLength + design.stemLength, stemRx, centerline),
    chamber,
    wallInner: { x: rim.x, y: inner },
    wallOuter: { x: rim.x, y: outer },
  }
}

function Dim({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g className="dim">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <text x={mx} y={my - 5} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}
