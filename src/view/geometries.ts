import * as THREE from 'three'
import type { PipeDesign, ShankSection, Vec2 } from '../domain/types'
import {
  diamondSole,
  fromWorld,
  innerRadiusAt,
  layoutPipe,
  outerRadiusAt,
  sectionAt,
  shankScaleAt,
  stemSection,
  toWorld,
  type PathPoint,
  type PipeLayout,
  type SectionHalf,
} from '../domain/geometry'

function addRing(positions: number[], ring: THREE.Vector3[]) {
  for (const p of ring) positions.push(p.x, p.y, p.z)
}

function stitch(indices: number[], a0: number, b0: number, count: number) {
  for (let k = 0; k < count; k++) {
    const k2 = (k + 1) % count
    indices.push(a0 + k, b0 + k, b0 + k2, a0 + k, b0 + k2, a0 + k2)
  }
}

function sectionPoints(section: ShankSection, half: SectionHalf): [number, number][] {
  if (section === 'diamond') {
    return [
      [0, half.ry],
      [half.rx, 0],
      [0, -half.ry],
      [-half.rx, 0],
    ]
  }
  if (section === 'square') {
    return [
      [half.rx, half.ry],
      [half.rx, -half.ry],
      [-half.rx, -half.ry],
      [-half.rx, half.ry],
    ]
  }
  const n = 20
  const pts: [number, number][] = []
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    pts.push([Math.cos(a) * half.rx, Math.sin(a) * half.ry])
  }
  return pts
}

function sweep(
  samples: { p: Vec2; tx: number; ty: number; half: SectionHalf }[],
  section: ShankSection,
  caps: { start: boolean; end: boolean } = { start: true, end: true },
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  if (samples.length < 2) return geo
  const shape = sectionPoints(section, samples[0].half)
  const count = shape.length
  const positions: number[] = []
  const indices: number[] = []
  samples.forEach((sample, i) => {
    const local = sectionPoints(section, sample.half)
    const upX = -sample.ty
    const upY = sample.tx
    const ring: THREE.Vector3[] = local.map(([ox, oy]) => new THREE.Vector3(sample.p.x + upX * oy, sample.p.y + upY * oy, ox))
    const base = i * count
    addRing(positions, ring)
    if (i > 0) stitch(indices, base - count, base, count)
  })
  const cap = (index: number, flip: boolean) => {
    const center = samples[index].p
    const cIndex = positions.length / 3
    positions.push(center.x, center.y, 0)
    const base = index * count
    for (let k = 0; k < count; k++) {
      const k2 = (k + 1) % count
      if (flip) indices.push(cIndex, base + k2, base + k)
      else indices.push(cIndex, base + k, base + k2)
    }
  }
  if (caps.start) cap(0, true)
  if (caps.end) cap(samples.length - 1, true)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function pathSamples(centerline: PathPoint[], from: number, to: number, halfAt: (s: number) => SectionHalf): { p: Vec2; tx: number; ty: number; half: SectionHalf; s: number }[] {
  const span = centerline.filter((p) => p.s >= from - 0.01 && p.s <= to + 0.01)
  if (span.length < 2) return []
  return span.map((p) => ({ p, tx: p.tx, ty: p.ty, half: halfAt(p.s), s: p.s }))
}

function bowlPoint(x: number, y: number, z: number, cant: number, sit: number): [number, number, number] {
  const th = (cant * Math.PI) / 180
  const xr = x * Math.cos(th) - y * Math.sin(th)
  const yr = x * Math.sin(th) + y * Math.cos(th) + sit
  return [xr, yr, z]
}

/** Низ бульдога — ромб, который сходится с ромбом шинки. Выше колец чаша круглая. */
function buildDiamondHeelBowl(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const H = design.bowlHeight
  const sole = diamondSole(design)
  const join = sole + (H - sole) * 0.58
  const positions: number[] = []
  const indices: number[] = []
  const put = (x: number, y: number, z: number) => {
    const p = bowlPoint(x, y, z, design.cantDeg, layout.sit)
    const i = positions.length / 3
    positions.push(p[0], p[1], p[2])
    return i
  }
  const lowerN = 14
  const corners = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
  const grid: number[][] = []
  for (let i = 0; i <= lowerN; i++) {
    const s = sole + ((join - sole) * i) / lowerN
    const r = Math.max(outerRadiusAt(design, s), 0.4)
    const row: number[] = []
    for (const a of corners) {
      row.push(put(Math.cos(a) * r, s, Math.sin(a) * r))
    }
    grid.push(row)
  }
  const bottom = put(0, sole, 0)
  for (let k = 0; k < 4; k++) indices.push(bottom, grid[0][k], grid[0][(k + 1) % 4])
  for (let i = 0; i < lowerN; i++) {
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4
      const a = grid[i][k]
      const b = grid[i][k2]
      const c = grid[i + 1][k]
      const d = grid[i + 1][k2]
      indices.push(a, c, b, b, c, d)
    }
  }
  const around = 28
  const upperN = 22
  const upper: number[][] = []
  for (let i = 0; i <= upperN; i++) {
    const s = join + ((H - join) * i) / upperN
    const r = outerRadiusAt(design, s)
    const roundness = Math.min(1, (s - join) / Math.max(1, H * 0.16))
    const row: number[] = []
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const denom = Math.abs(c) + Math.abs(sn) || 1
      const x = ((c / denom) * (1 - roundness) + c * roundness) * r
      const z = ((sn / denom) * (1 - roundness) + sn * roundness) * r
      row.push(put(x, s, z))
    }
    upper.push(row)
  }
  const quad = around / 4
  const low = grid[lowerN]
  const up0 = upper[0]
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < quad; k++) {
      const u0 = q * quad + k
      const u1 = (u0 + 1) % around
      indices.push(low[q], up0[u0], up0[u1])
      if (k === quad - 1) indices.push(low[q], up0[u1], low[(q + 1) % 4])
    }
  }
  for (let i = 0; i < upperN; i++) {
    for (let k = 0; k < around; k++) {
      const k2 = (k + 1) % around
      indices.push(upper[i][k], upper[i + 1][k], upper[i][k2], upper[i][k2], upper[i + 1][k], upper[i + 1][k2])
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function buildBowlGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  if (design.shankSection === 'diamond') return buildDiamondHeelBowl(design, layout)
  const H = design.bowlHeight
  const pts: THREE.Vector2[] = []
  const n = 72
  if (design.flatHeel) pts.push(new THREE.Vector2(0, 0))
  for (let i = 0; i <= n; i++) {
    const s = (H * i) / n
    const r = outerRadiusAt(design, s)
    const prev = pts[pts.length - 1]
    if (prev && Math.hypot(prev.x - r, prev.y - s) < 0.15) continue
    pts.push(new THREE.Vector2(Math.max(0, r), s))
  }
  const geo = new THREE.LatheGeometry(pts, 56)
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ((design.cantDeg * Math.PI) / 180))
  geo.translate(0, layout.sit, 0)
  geo.computeVertexNormals()
  return geo
}

export function buildChamberGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const H = design.bowlHeight
  const depth = Math.min(design.chamberDepth, H - 0.4)
  const pts: THREE.Vector2[] = []
  const n = 36
  for (let i = n; i >= 0; i--) {
    const dist = (depth * i) / n
    const s = H - dist
    const r = innerRadiusAt(design, dist)
    pts.push(new THREE.Vector2(Math.max(0, r), s))
  }
  const geo = new THREE.LatheGeometry(pts, 40)
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ((design.cantDeg * Math.PI) / 180))
  geo.translate(0, layout.sit, 0)
  geo.computeVertexNormals()
  return geo
}

/** Точки сечения. У ромба и квадрата рёбра делятся, чтобы срез повторил кривую чаши, а не хорду. */
function contourOutline(section: ShankSection, half: SectionHalf): [number, number][] {
  const corners = sectionPoints(section, half)
  if (section === 'round') return corners
  const div = 6
  const pts: [number, number][] = []
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    for (let k = 0; k < div; k++) {
      const t = k / div
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return pts
}

/**
 * Торец чубука — не плоскость. Каждая образующая доводится до поверхности чаши,
 * поэтому срез повторяет её форму.
 */
export function buildShankGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const half = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio)
  const unit = contourOutline(design.shankSection, half)
  const sized = (s: number) => {
    const k = shankScaleAt(design, Math.max(0, s))
    return unit.map(([ox, oy]) => [ox * k, oy * k] as [number, number])
  }
  const outline = sized(0)
  const origin = layout.junction
  const axis = layout.centerline.find((p) => p.s >= -0.01) ?? layout.centerline[0]
  const tx = axis?.tx ?? 1
  const ty = axis?.ty ?? 0
  const dir = new THREE.Vector3(tx, ty, 0)
  if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0)
  dir.normalize()
  const station = (s: number, ox: number, oy: number) =>
    new THREE.Vector3(origin.x + dir.x * s - dir.y * oy, origin.y + dir.y * s + dir.x * oy, ox)

  const bowlGeo = buildBowlGeometry(design, layout)
  const bowlMesh = new THREE.Mesh(bowlGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  const raycaster = new THREE.Raycaster()
  const far = design.bowlDiameter + design.bowlHeight + 40
  const embed = 0.4
  const th = (design.cantDeg * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const analyticExit = (ox: number, oy: number) => {
    const sole = diamondSole(design)
    const H = design.bowlHeight
    const join = sole + (H - sole) * 0.58
    const inside = (s: number) => {
      const p = station(s, ox, oy)
      const dx = p.x
      const dy = p.y - layout.sit
      const lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      if (ly <= sole + 0.05 || ly >= H - 0.05) return false
      const r = outerRadiusAt(design, ly)
      if (r < 0.2) return false
      const diamond = design.shankSection === 'diamond' && ly < join
      return diamond ? Math.abs(lx) + Math.abs(p.z) <= r : Math.hypot(lx, p.z) <= r
    }
    let prev = false
    let edge = Number.NaN
    for (let s = -far; s <= design.shankLength; s += 1) {
      const now = inside(s)
      if (prev && !now) edge = s
      prev = now
    }
    if (!Number.isFinite(edge)) return null
    let lo = edge - 1
    let hi = edge
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2
      if (inside(mid)) lo = mid
      else hi = mid
    }
    return lo
  }
  const cut: THREE.Vector3[] = []
  const exitS: number[] = []
  for (const [ox, oy] of outline) {
    const start = station(-far, ox, oy)
    raycaster.set(start, dir)
    raycaster.far = far + design.shankLength
    const hits = raycaster.intersectObject(bowlMesh, false)
    const hit = hits.length ? hits[hits.length - 1] : null
    const analytic = analyticExit(ox, oy)
    const rayS = hit ? -far + hit.distance : null
    const s = rayS != null && (analytic == null || rayS > analytic - 2) ? rayS : analytic
    if (s != null) {
      cut.push(station(s - embed, ox, oy))
      exitS.push(s)
      continue
    }
    let bestS = 0
    let bestGap = Infinity
    for (let t = -far; t <= design.shankLength; t += 0.75) {
      const p = station(t, ox, oy)
      const dx = p.x
      const dy = p.y - layout.sit
      const lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      if (ly <= 0.2 || ly >= design.bowlHeight) continue
      const r = outerRadiusAt(design, ly)
      const gap = Math.hypot(lx, p.z) - r
      if (gap < bestGap) {
        bestGap = gap
        bestS = t
      }
    }
    const p = station(bestS, ox, oy)
    const dx = p.x
    const dy = p.y - layout.sit
    const lx = dx * cos + dy * sin
    const ly = -dx * sin + dy * cos
    const r = Math.max(0.4, outerRadiusAt(design, ly) - embed)
    const rad = Math.hypot(lx, p.z) || 1
    const scale = Math.min(1, r / rad)
    const nlx = lx * scale
    const nlz = p.z * scale
    cut.push(new THREE.Vector3(nlx * cos - ly * sin, nlx * sin + ly * cos + layout.sit, nlz))
    exitS.push(bestS)
  }
  bowlGeo.dispose()
  ;(bowlMesh.material as THREE.Material).dispose()

  const count = outline.length
  const positions: number[] = []
  const indices: number[] = []
  const pushRing = (pts: THREE.Vector3[]) => {
    const base = positions.length / 3
    addRing(positions, pts)
    return base
  }
  let prev = pushRing(cut)
  const s1 = Math.max(...exitS, 0) + 1.4
  const stations = [s1]
  for (const sample of pathSamples(layout.centerline, s1, design.shankLength, () => half)) {
    if (sample.s > stations[stations.length - 1] + 0.6) stations.push(sample.s)
  }
  if (stations[stations.length - 1] < design.shankLength - 0.2) stations.push(design.shankLength)
  for (const s of stations) {
    const base = pushRing(sized(s).map(([ox, oy]) => station(s, ox, oy)))
    stitch(indices, prev, base, count)
    prev = base
  }
  const end = station(design.shankLength, 0, 0)
  const cIndex = positions.length / 3
  positions.push(end.x, end.y, end.z)
  for (let k = 0; k < count; k++) {
    const k2 = (k + 1) % count
    indices.push(cIndex, prev + k2, prev + k)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  seatGeometry(geo, design, layout)
  return geo
}

function seatGeometry(geo: THREE.BufferGeometry, design: PipeDesign, layout: PipeLayout) {
  const pos = geo.getAttribute('position')
  if (!pos) return
  const sole = diamondSole(design)
  for (let i = 0; i < pos.count; i++) {
    const local = fromWorld(pos.getX(i), pos.getY(i), design.cantDeg, layout.sit)
    if (local.y >= sole) continue
    const seated = toWorld(local.x, sole, design.cantDeg, layout.sit)
    pos.setXY(i, seated.x, seated.y)
  }
  geo.computeVertexNormals()
}

export function buildStemGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const total = design.shankLength + design.stemLength
  const samples = pathSamples(layout.centerline, design.shankLength - 1.4, total, (s) => {
    const t = (s - design.shankLength) / Math.max(1, design.stemLength)
    return stemSection(design, Math.max(0, t))
  })
  const geo = sweep(samples, design.shankSection, { start: false, end: true })
  seatGeometry(geo, design, layout)
  return geo
}

export function buildAirwayGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const r = design.airwayDiameter / 2
  const pts = layout.airway
  const samples = pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(pts.length - 1, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    return { p, tx, ty, half: { rx: r, ry: r } }
  })
  return sweep(samples, 'round')
}

export function buildMortiseGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const face = layout.shankFace
  const samples = [0, 0.35, 0.7, 1].map((t) => ({
    p: {
      x: face.x - face.tx * design.mortiseDepth * t,
      y: face.y - face.ty * design.mortiseDepth * t,
    },
    tx: face.tx,
    ty: face.ty,
    half: { rx: design.mortiseDiameter / 2, ry: design.mortiseDiameter / 2 },
  }))
  return sweep(samples, 'round')
}

export function buildSlotGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const mouth = layout.mouth
  const depth = Math.min(3.2, Math.max(1.6, design.slotHeight + 1.4))
  const proud = 0.08
  const steps = 10
  const samples = []
  for (let i = 0; i <= steps; i++) {
    const back = -proud + ((depth + proud) * i) / steps
    const open = 1 - i / steps
    samples.push({
      p: { x: mouth.x - mouth.tx * back, y: mouth.y - mouth.ty * back },
      tx: mouth.tx,
      ty: mouth.ty,
      half: {
        rx: Math.max(2.1, design.airwayDiameter / 2) * (1 + 0.35 * open),
        ry: Math.max(0.45, design.slotHeight / 2) * (1 + 0.15 * open),
      },
    })
  }
  return sweep(samples, 'round', { start: true, end: true })
}

export function buildRimGeometry(design: PipeDesign, layout: PipeLayout): THREE.BufferGeometry {
  const H = design.bowlHeight
  const outer = Math.max(outerRadiusAt(design, H), 1)
  const inner = Math.min(Math.max(design.chamberDiameter / 2, 0.6), outer - 0.4)
  const lip = 0.45
  const pts = [
    new THREE.Vector2(inner, H - 0.08),
    new THREE.Vector2(outer, H - 0.08),
    new THREE.Vector2(outer, H + lip),
    new THREE.Vector2(inner, H + lip),
  ]
  const geo = new THREE.LatheGeometry(pts, 64)
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ((design.cantDeg * Math.PI) / 180))
  geo.translate(0, layout.sit, 0)
  geo.computeVertexNormals()
  return geo
}

export interface PipeGeometries {
  bowl: THREE.BufferGeometry
  rim: THREE.BufferGeometry
  chamber: THREE.BufferGeometry
  shank: THREE.BufferGeometry
  stem: THREE.BufferGeometry
  airway: THREE.BufferGeometry
  mortise: THREE.BufferGeometry
  slot: THREE.BufferGeometry
  layout: PipeLayout
}

export function buildPipeGeometries(design: PipeDesign): PipeGeometries {
  const layout = layoutPipe(design)
  return {
    layout,
    bowl: buildBowlGeometry(design, layout),
    rim: buildRimGeometry(design, layout),
    chamber: buildChamberGeometry(design, layout),
    shank: buildShankGeometry(design, layout),
    stem: buildStemGeometry(design, layout),
    airway: buildAirwayGeometry(design, layout),
    mortise: buildMortiseGeometry(design, layout),
    slot: buildSlotGeometry(design, layout),
  }
}

export function disposeGeometries(geos: PipeGeometries) {
  geos.bowl.dispose()
  geos.rim.dispose()
  geos.chamber.dispose()
  geos.shank.dispose()
  geos.stem.dispose()
  geos.airway.dispose()
  geos.mortise.dispose()
  geos.slot.dispose()
}
