import type { Bend, PipeDesign, ShankSection, Vec2 } from './types'
import { clamp } from './format'

/** Угол от чубука к оси чаши. 90° — чубук поперёк. Чем меньше угол, тем сильнее чубук задран вверх. */
export function bendDegrees(bend: Bend): number {
  switch (bend) {
    case 'straight':
      return 90
    case 'eighth':
      return 82
    case 'quarter':
      return 74
    case 'half':
      return 62
    case 'threeQuarter':
      return 48
    case 'full':
      return 28
  }
}

export function bendFromDegrees(deg: number): Bend {
  const steps: Bend[] = ['straight', 'eighth', 'quarter', 'half', 'threeQuarter', 'full']
  let best: Bend = 'straight'
  let gap = Infinity
  for (const step of steps) {
    const d = Math.abs(bendDegrees(step) - deg)
    if (d < gap) {
      gap = d
      best = step
    }
  }
  return best
}

/** Доля радиуса на высоте t. Числа берутся из трубки, а не из имени формы. */
function kAt(design: PipeDesign, t: number): number {
  const tn = clamp(t, 0, 1)
  const peak = clamp(design.peakAt, 0.2, 1)
  const rim = clamp(design.rimFactor, 0.7, 1)
  const foot = clamp(design.footFactor, 0.35, 1)
  if (peak >= 0.98) return foot + (rim - foot) * tn
  if (tn >= peak) {
    const u = (tn - peak) / Math.max(0.05, 1 - peak)
    return 1 - (1 - rim) * Math.pow(u, 0.7)
  }
  const u = tn / Math.max(0.05, peak)
  return foot + (1 - foot) * u
}

export function grooveDepth(design: PipeDesign, t: number): number {
  if (!design.rings) return 0
  const centers = design.rings === 2 ? [0.74, 0.83] : [0.8]
  let g = 0
  for (const c of centers) {
    const d = Math.abs(t - c)
    if (d < 0.028) g = Math.max(g, 0.8 * (1 - d / 0.028))
  }
  return g
}

/**
 * Бульдог и родезийский: два конуса основаниями друг к другу.
 * Самое широкое место у колец, кромка уже, низ сужается к шинке.
 */
function ringedConeK(design: PipeDesign, t: number): number {
  if (design.peakAt >= 0.98) return kAt(design, t)
  const peak = clamp(design.peakAt, 0.25, 0.98)
  const heel = clamp(design.footFactor, 0.35, 1)
  const rim = clamp(design.rimFactor, 0.7, 1)
  const tn = clamp(t, 0, 1)
  if (tn <= peak) return heel + (1 - heel) * Math.pow(tn / peak, 0.9)
  return 1 + (rim - 1) * ((tn - peak) / (1 - peak))
}

/**
 * Локальная высота нижней грани чубука на оси чаши.
 * У ромба дно чаши стоит на этой грани, а не ниже неё.
 */
export function diamondSole(design: PipeDesign): number {
  if (design.flatHeel || design.shankSection !== 'diamond') return 0
  const theta = (bendDegrees(design.bend) * Math.PI) / 180
  const D = { x: Math.sin(theta), y: Math.cos(theta) }
  const N = { x: D.y, y: -D.x }
  const H = Math.max(8, design.bowlHeight)
  const depth = Math.min(design.chamberDepth, H - 0.6)
  const Rc = Math.max(1, design.chamberDiameter / 2)
  const ry = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio).ry
  const ox = N.x * (Rc + ry)
  const oy = H - depth + Rc + N.y * (Rc + ry)
  const t = Math.abs(D.x) > 0.08 ? -ox / D.x : 0
  return clamp(oy + D.y * t, 0, H * 0.4)
}

/** Радиус пятки на высоте s. Касательная у оси горизонтальная и совпадает с наклоном стенки на стыке. */
function heelRadiusAt(s: number, hr: number, Rw: number, slope: number, leaveK: number): number {
  const target = clamp(s / Math.max(hr, 0.001), 0, 1)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (mid * mid * (2 - mid) < target) lo = mid
    else hi = mid
  }
  const u = (lo + hi) / 2
  const u2 = u * u
  const u3 = u2 * u
  const leave = Rw * leaveK
  const arrive = slope * hr
  return (u3 - 2 * u2 + u) * leave + (-2 * u3 + 3 * u2) * Rw + (u3 - u2) * arrive
}

/**
 * Наружный радиус чаши на расстоянии s от пятки по оси, мм.
 * У обычной трубки дно скруглено. Плоский срез остаётся только у покера.
 */
export function outerRadiusAt(design: PipeDesign, s: number): number {
  const H = Math.max(8, design.bowlHeight)
  const R = design.bowlDiameter / 2
  const t = clamp(s / H, 0, 1)
  const groove = grooveDepth(design, t)
  if (design.flatHeel) return Math.max(0, R * kAt(design, t) - groove)
  if (design.rings > 0) {
    if (design.shankSection === 'diamond') {
      if (s < diamondSole(design) - 0.05) return 0
      return Math.max(0, R * ringedConeK(design, t) - groove)
    }
    const shaped = R * ringedConeK(design, t)
    const hr = Math.min(H * 0.55, Math.max(0, design.heelMm))
    if (s >= hr) return Math.max(0, shaped - groove)
    const joinT = hr / H
    const Rw = Math.max(1, R * ringedConeK(design, joinT))
    const slope = (R * (ringedConeK(design, clamp(joinT + 0.03, 0, 1)) - ringedConeK(design, clamp(joinT - 0.03, 0, 1)))) / (0.06 * H)
    return Math.max(0, heelRadiusAt(s, hr, Rw, slope, design.heelLeave) - groove)
  }

  const hr = Math.min(H * 0.55, Math.max(0, design.heelMm))
  const leave = design.heelLeave
  if (s >= hr) return Math.max(0, R * kAt(design, t) - groove)

  const join = clamp(hr / H, 0, 1)
  const Rw = Math.max(1, R * kAt(design, join))
  const eps = 0.8 / H
  const slope = (R * (kAt(design, clamp(join + eps, 0, 1)) - kAt(design, clamp(join - eps, 0, 1)))) / 1.6
  return Math.max(0, heelRadiusAt(s, hr, Rw, slope, leave) - groove)
}

/** Радиус камеры на расстоянии от кромки вдоль оси. */
export function innerRadiusAt(design: PipeDesign, distFromRim: number): number {
  const depth = Math.max(1, design.chamberDepth)
  const Rc = design.chamberDiameter / 2
  const u = clamp(distFromRim / depth, 0, 1)
  let r = design.chamberTaper ? Rc * (1 - 0.22 * u) : Rc
  const fromBottom = depth - distFromRim
  if (fromBottom < r && r > 0) {
    const sphere = Math.sqrt(Math.max(0, r * r - (r - fromBottom) ** 2))
    r = Math.min(r, sphere)
  }
  return Math.max(0, r)
}

export function toWorld(localX: number, localY: number, cantDeg: number, sit: number): Vec2 {
  const th = (cantDeg * Math.PI) / 180
  return {
    x: localX * Math.cos(th) - localY * Math.sin(th),
    y: localX * Math.sin(th) + localY * Math.cos(th) + sit,
  }
}

export function fromWorld(x: number, y: number, cantDeg: number, sit: number): Vec2 {
  const th = (cantDeg * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const dy = y - sit
  return { x: x * cos + dy * sin, y: -x * sin + dy * cos }
}

/** Низ чубука не опускается ниже пятки. Канал при этом остаётся на своём месте. */
export function seatOnSole(points: Vec2[], design: PipeDesign, sit: number): Vec2[] {
  const sole = diamondSole(design)
  return points.map((p) => {
    const local = fromWorld(p.x, p.y, design.cantDeg, sit)
    if (local.y >= sole) return p
    return toWorld(local.x, sole, design.cantDeg, sit)
  })
}

function bowlSamples(design: PipeDesign, sit: number): { side: Vec2[]; mouthSide: Vec2[]; maxX: number; minY: number } {
  const H = design.bowlHeight
  const side: Vec2[] = []
  const mouthSide: Vec2[] = []
  let maxX = -Infinity
  let minY = Infinity
  const n = 72
  const s0 = diamondSole(design)
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((H - s0) * i) / n
    const r = outerRadiusAt(design, s)
    const away = toWorld(-r, s, design.cantDeg, sit)
    const toward = toWorld(r, s, design.cantDeg, sit)
    side.push(away)
    mouthSide.push(toward)
    maxX = Math.max(maxX, toward.x, away.x)
    minY = Math.min(minY, toward.y, away.y)
  }
  return { side, mouthSide, maxX, minY }
}

export interface SectionHalf {
  rx: number
  ry: number
}

/** Чубук толще у чаши и сходится к торцу. Номинальный диаметр — это торец, где гнездо. */
export function shankScaleAt(design: PipeDesign, s: number): number {
  const u = clamp(s / Math.max(design.shankLength, 1), 0, 1)
  return 1 + clamp(design.shankTaper, 0, 0.28) * (1 - u)
}

export function sectionAt(section: ShankSection, diameter: number, ovalRatio = 0.62): SectionHalf {
  const r = diameter / 2
  switch (section) {
    case 'round':
      return { rx: r, ry: r }
    case 'oval':
      return { rx: r, ry: r * clamp(ovalRatio, 0.5, 1) }
    case 'diamond':
      return { rx: r * 0.92, ry: r }
    case 'square':
      return { rx: r * 0.86, ry: r * 0.86 }
  }
}

export interface PathPoint extends Vec2 {
  s: number
  tx: number
  ty: number
}

export function curveRadius(): number {
  return Infinity
}

function worldDir(local: Vec2, cantDeg: number): { tx: number; ty: number } {
  const th = (cantDeg * Math.PI) / 180
  return {
    tx: local.x * Math.cos(th) - local.y * Math.sin(th),
    ty: local.x * Math.sin(th) + local.y * Math.cos(th),
  }
}

function inWood(design: PipeDesign, lx: number, ly: number): boolean {
  if (ly <= 0.35 || ly >= design.bowlHeight - 0.1) return false
  return Math.abs(lx) <= outerRadiusAt(design, ly) - 0.15
}

/** Ось чубука в системе чаши: угол к оси чаши, касательная к скруглению дна. */
function shankAxis(design: PipeDesign, sit: number): { dir: { tx: number; ty: number }; touch: Vec2; junction: Vec2 } {
  const theta = (bendDegrees(design.bend) * Math.PI) / 180
  const D = { x: Math.sin(theta), y: Math.cos(theta) }
  const N = { x: D.y, y: -D.x }
  const H = design.bowlHeight
  const depth = Math.min(design.chamberDepth, H - 0.6)
  const yFloor = H - depth
  const Rc = Math.max(1, design.chamberDiameter / 2)
  const centerY = yFloor + Rc
  const touchL = { x: N.x * Rc, y: centerY + N.y * Rc }
  const dir = worldDir(D, design.cantDeg)
  const far = H + design.bowlDiameter + 30
  let lo = 0
  if (!inWood(design, touchL.x, touchL.y)) {
    for (let t = 0; t <= 10; t += 0.2) {
      if (inWood(design, touchL.x + D.x * t, touchL.y + D.y * t)) {
        lo = t
        break
      }
    }
  }
  let hi = far
  while (hi - lo > 0.04) {
    const mid = (lo + hi) / 2
    if (inWood(design, touchL.x + D.x * mid, touchL.y + D.y * mid)) lo = mid
    else hi = mid
  }
  const exitL = { x: touchL.x + D.x * (lo + 0.45), y: touchL.y + D.y * (lo + 0.45) }
  return {
    dir,
    touch: toWorld(touchL.x, touchL.y, design.cantDeg, sit),
    junction: toWorld(exitL.x, exitL.y, design.cantDeg, sit),
  }
}

function pushLine(pts: PathPoint[], exit: Vec2, dir: { tx: number; ty: number }, from: number, to: number, ds: number) {
  for (let s = from; s <= to + 0.01; s += ds) {
    pts.push({ x: exit.x + dir.tx * s, y: exit.y + dir.ty * s, s, tx: dir.tx, ty: dir.ty })
  }
}

/**
 * Чубук прямой. У гнутых форм дуга только в мундштуке:
 * от направления чубука к горизонтали у прикуса.
 */
function sampleCenterline(
  exit: Vec2,
  dir: { tx: number; ty: number },
  shankLen: number,
  stemLen: number,
  inset: number,
  bendStem: boolean,
): { pts: PathPoint[]; bendRadius: number } {
  const pts: PathPoint[] = []
  const ds = 1.5
  if (inset > 0.05) {
    pts.push({ x: exit.x - dir.tx * inset, y: exit.y - dir.ty * inset, s: -inset, tx: dir.tx, ty: dir.ty })
  }
  pushLine(pts, exit, dir, 0, shankLen, ds)
  const face = { x: exit.x + dir.tx * shankLen, y: exit.y + dir.ty * shankLen }
  const atFace = pts[pts.length - 1]
  if (!atFace || atFace.s < shankLen - 0.05) pts.push({ x: face.x, y: face.y, s: shankLen, tx: dir.tx, ty: dir.ty })
  const alpha = Math.atan2(dir.ty, dir.tx)
  const turn = bendStem ? Math.max(0, alpha) : 0
  if (turn < 0.04 || stemLen < 8) {
    pushLine(pts, exit, dir, shankLen + ds, shankLen + stemLen, ds)
    const total = shankLen + stemLen
    const last = pts[pts.length - 1]
    if (!last || last.s < total - 0.2) {
      pts.push({ x: exit.x + dir.tx * total, y: exit.y + dir.ty * total, s: total, tx: dir.tx, ty: dir.ty })
    }
    return { pts, bendRadius: Infinity }
  }
  const radius = stemLen / turn
  const cx = face.x + dir.ty * radius
  const cy = face.y - dir.tx * radius
  for (let s = ds; s <= stemLen + 0.01; s += ds) {
    const phi = Math.min(turn, s / radius)
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const vx = -dir.ty * cos + dir.tx * sin
    const vy = dir.ty * sin + dir.tx * cos
    const tx = dir.tx * cos + dir.ty * sin
    const ty = -dir.tx * sin + dir.ty * cos
    const len = Math.hypot(tx, ty) || 1
    pts.push({
      x: cx + vx * radius,
      y: cy + vy * radius,
      s: shankLen + s,
      tx: tx / len,
      ty: ty / len,
    })
  }
  return { pts, bendRadius: radius }
}

function pointAt(pts: PathPoint[], s: number): PathPoint {
  if (!pts.length) return { x: 0, y: 0, s: 0, tx: 1, ty: 0 }
  if (s <= pts[0].s) return pts[0]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].s >= s) {
      const a = pts[i - 1]
      const b = pts[i]
      const t = (s - a.s) / Math.max(0.0001, b.s - a.s)
      const tx = a.tx + (b.tx - a.tx) * t
      const ty = a.ty + (b.ty - a.ty) * t
      const len = Math.hypot(tx, ty) || 1
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        s,
        tx: tx / len,
        ty: ty / len,
      }
    }
  }
  return pts[pts.length - 1]
}

function distPointLine(p: Vec2, origin: Vec2, dir: Vec2): number {
  const vx = p.x - origin.x
  const vy = p.y - origin.y
  return Math.abs(vx * dir.y - vy * dir.x)
}

export interface PipeLayout {
  sit: number
  heel: Vec2
  rimCenter: Vec2
  chamberBottom: Vec2
  bowlOutline: Vec2[]
  junction: Vec2
  centerline: PathPoint[]
  shankFace: PathPoint
  mouth: PathPoint
  mortiseBottom: Vec2
  airway: Vec2[]
  aimError: number
  drillAngleDeg: number
  shankAngleDeg: number
  breakout: boolean
  bendRadius: number
  minSideWall: number
  rimWall: number
  heelWall: number
  shankWall: number
  bowlMaxX: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

function walls(design: PipeDesign): { minSideWall: number; rimWall: number; heelWall: number; shankWall: number } {
  const H = design.bowlHeight
  const depth = Math.min(design.chamberDepth, H)
  let minSide = Infinity
  const steps = 36
  for (let i = 0; i <= steps; i++) {
    const d = (depth * i) / steps
    const s = H - d
    if (s < 0) continue
    const wall = outerRadiusAt(design, s) - innerRadiusAt(design, d)
    if (wall < minSide) minSide = wall
  }
  const rimWall = outerRadiusAt(design, H) - design.chamberDiameter / 2
  const sec = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio)
  const minor = Math.min(sec.rx, sec.ry) * 2
  const shankWall = (minor - design.mortiseDiameter) / 2
  return {
    minSideWall: Number.isFinite(minSide) ? minSide : 0,
    rimWall,
    heelWall: H - design.chamberDepth,
    shankWall,
  }
}

export function layoutPipe(design: PipeDesign): PipeLayout {
  const dry = bowlSamples(design, 0)
  const sit = -dry.minY
  const sampled = bowlSamples(design, sit)
  const H = design.bowlHeight
  const rimCenter = toWorld(0, H, design.cantDeg, sit)
  const heel = toWorld(0, diamondSole(design), design.cantDeg, sit)
  const chamberBottom = toWorld(0, H - Math.min(design.chamberDepth, H), design.cantDeg, sit)
  const sec = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio)
  const shankAngleDeg = bendDegrees(design.bend)
  const axis = shankAxis(design, sit)
  const dir = axis.dir
  const junction = axis.junction
  const traced = sampleCenterline(junction, dir, design.shankLength, design.stemLength, 0.45, design.bend !== 'straight')
  const centerline = traced.pts
  const shankFace = pointAt(centerline, design.shankLength)
  const mouth = pointAt(centerline, design.shankLength + design.stemLength)
  const mortiseBottom = {
    x: shankFace.x - shankFace.tx * design.mortiseDepth,
    y: shankFace.y - shankFace.ty * design.mortiseDepth,
  }
  const airway: Vec2[] = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    airway.push({
      x: axis.touch.x + (mortiseBottom.x - axis.touch.x) * t,
      y: axis.touch.y + (mortiseBottom.y - axis.touch.y) * t,
    })
  }
  const back = { x: -shankFace.tx, y: -shankFace.ty }
  const aimError = distPointLine(chamberBottom, shankFace, back)
  const aim = {
    x: axis.touch.x - mortiseBottom.x,
    y: axis.touch.y - mortiseBottom.y,
  }
  const aimLen = Math.hypot(aim.x, aim.y) || 1
  const dot = clamp((aim.x * back.x + aim.y * back.y) / aimLen, -1, 1)
  const drillAngleDeg = (Math.acos(dot) * 180) / Math.PI

  let breakout = false
  for (const p of airway) {
    if (p.x < junction.x + 2) continue
    let best = Infinity
    let bestS = 0
    for (const c of centerline) {
      if (c.s > design.shankLength) break
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < best) {
        best = d
        bestS = c.s
      }
    }
    if (bestS < 2) continue
    if (best > sec.ry - design.airwayDiameter / 2 - 0.6) breakout = true
  }

  const outline: Vec2[] = [...sampled.side, ...[...sampled.mouthSide].reverse()]
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of [...outline, ...centerline, mouth]) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  maxY = Math.max(maxY, rimCenter.y + outerRadiusAt(design, H) * Math.sin((design.cantDeg * Math.PI) / 180))
  const w = walls(design)
  return {
    sit,
    heel,
    rimCenter,
    chamberBottom,
    bowlOutline: outline,
    junction,
    centerline,
    shankFace,
    mouth,
    mortiseBottom,
    airway,
    aimError,
    drillAngleDeg,
    shankAngleDeg,
    breakout,
    bendRadius: traced.bendRadius,
    ...w,
    bowlMaxX: sampled.maxX,
    bounds: { minX, maxX, minY, maxY: Math.max(maxY, rimCenter.y + 4) },
  }
}

export function stemSection(design: PipeDesign, t: number): SectionHalf {
  const start = sectionAt(design.shankSection, design.shankDiameter, design.ovalRatio)
  const len = Math.max(24, design.stemLength)
  const fromEnd = (1 - clamp(t, 0, 1)) * len
  const buttonLen = 6
  const neck = 2.2
  const button: SectionHalf = { rx: 7.2, ry: Math.max(1.8, design.buttonThickness / 2) }
  const bit: SectionHalf = { rx: 5.1, ry: Math.max(1.45, button.ry - 0.6) }
  if (fromEnd <= 0.8) {
    const k = fromEnd / 0.8
    return { rx: button.rx * (0.9 + 0.1 * k), ry: button.ry * (0.84 + 0.16 * k) }
  }
  if (fromEnd <= buttonLen) return button
  if (fromEnd <= buttonLen + neck) {
    const u = (fromEnd - buttonLen) / neck
    return { rx: button.rx + (bit.rx - button.rx) * u, ry: button.ry + (bit.ry - button.ry) * u }
  }
  const along = clamp((len - fromEnd) / Math.max(1, len - buttonLen - neck), 0, 1)
  if (design.stemStyle === 'saddle' && along < 0.7) return start
  const u = design.stemStyle === 'saddle' ? (along - 0.7) / 0.3 : along
  return { rx: start.rx + (bit.rx - start.rx) * u, ry: start.ry + (bit.ry - start.ry) * u }
}

export interface HandlePositions {
  bowl: Vec2
  shank: Vec2
  bend: Vec2
  stem: Vec2
}

export function handlePositions(design: PipeDesign, layout: PipeLayout): HandlePositions {
  const rimR = outerRadiusAt(design, design.bowlHeight)
  const bowl = toWorld(0, design.bowlHeight + rimR * 0.05, design.cantDeg, layout.sit)
  bowl.y += 3
  const bend = pointAt(layout.centerline, design.shankLength + design.stemLength * 0.45)
  return {
    bowl,
    shank: { x: layout.shankFace.x, y: layout.shankFace.y },
    bend,
    stem: { x: layout.mouth.x, y: layout.mouth.y },
  }
}

function pointAtLength(pts: PathPoint[], s: number): PathPoint {
  return pointAt(pts, s)
}

export { pointAtLength }

/** Продлить ось назад, чтобы обрезка нашла выход чубука из чаши. */
export function centerlineFrom(centerline: PathPoint[], from: number): PathPoint[] {
  if (!centerline.length) return centerline
  const origin = centerline[0]
  if (origin.s <= from + 0.01) return centerline.filter((p) => p.s >= from - 0.2)
  const extra: PathPoint[] = []
  for (let s = from; s < origin.s - 0.05; s += 1.5) {
    extra.push({
      x: origin.x + origin.tx * (s - origin.s),
      y: origin.y + origin.ty * (s - origin.s),
      s,
      tx: origin.tx,
      ty: origin.ty,
    })
  }
  return [...extra, ...centerline]
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const cross = (a.y > p.y) !== (b.y > p.y)
    if (!cross) continue
    const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x
    if (p.x < x) inside = !inside
  }
  return inside
}

function crossOut(a: Vec2, b: Vec2, inside: (p: Vec2) => boolean): Vec2 {
  if (!inside(a)) return a
  let lo = 0
  let hi = 1
  for (let k = 0; k < 16; k++) {
    const m = (lo + hi) / 2
    const p = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }
    if (inside(p)) lo = m
    else hi = m
  }
  return { x: a.x + (b.x - a.x) * hi, y: a.y + (b.y - a.y) * hi }
}

function nearestIndex(poly: Vec2[], p: Vec2): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < poly.length; i++) {
    const d = (poly[i].x - p.x) ** 2 + (poly[i].y - p.y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function chainBetween(poly: Vec2[], from: number, to: number, step: 1 | -1): Vec2[] {
  const chain: Vec2[] = []
  const n = poly.length
  for (let k = from, guard = 0; guard <= n; k = (k + step + n) % n, guard++) {
    chain.push(poly[k])
    if (k === to) break
  }
  return chain
}

/** Дуга контура между двумя точками стыка, по той стороне, где выходит чубук. */
function bridgeArc(bowl: Vec2[], from: Vec2, to: Vec2): Vec2[] {
  if (bowl.length < 3) return [from, to]
  const a = nearestIndex(bowl, from)
  const b = nearestIndex(bowl, to)
  const forward = chainBetween(bowl, a, b, 1)
  const backward = chainBetween(bowl, a, b, -1)
  const avgX = (chain: Vec2[]) => chain.reduce((sum, p) => sum + p.x, 0) / chain.length
  const mouth = avgX(forward) >= avgX(backward) ? forward : backward
  const mid = mouth.slice(1, -1)
  return [from, ...mid, to]
}

function clipEdge(edge: Vec2[], bowl: Vec2[]): Vec2[] {
  if (edge.length < 2 || bowl.length < 3) return edge
  const inside = (p: Vec2) => pointInPolygon(p, bowl)
  let bestAt = -1
  let best: Vec2 | null = null
  for (let i = 0; i < edge.length - 1; i++) {
    if (!inside(edge[i]) || inside(edge[i + 1])) continue
    const hit = crossOut(edge[i], edge[i + 1], inside)
    if (!best || hit.x >= best.x) {
      best = hit
      bestAt = i + 1
    }
  }
  if (best) return [best, ...edge.slice(bestAt)]
  const center = bowl.reduce((sum, p) => sum + p.x, 0) / bowl.length
  let snap = bowl[0]
  let snapD = Infinity
  let from = 0
  for (let i = 0; i < edge.length; i++) {
    for (let k = 0; k < bowl.length; k++) {
      if (bowl[k].x < center) continue
      const d = (bowl[k].x - edge[i].x) ** 2 + (bowl[k].y - edge[i].y) ** 2
      if (d < snapD) {
        snapD = d
        snap = bowl[k]
        from = i
      }
    }
  }
  return [snap, ...edge.slice(from).filter((p) => p.x >= snap.x - 0.3)]
}

/**
 * Чубук на чертеже доходит до чаши по её контуру: верх и низ отдельно,
 * а между ними — дуга чаши, не прямой срез.
 */
export function joinBand(upper: Vec2[], lower: Vec2[], bowl: Vec2[]): { upper: Vec2[]; lower: Vec2[]; bridge: Vec2[] } {
  const up = clipEdge(upper, bowl)
  const lo = clipEdge(lower, bowl)
  return { upper: up, lower: lo, bridge: bridgeArc(bowl, lo[0], up[0]) }
}

/** Оставить ленту чубука только снаружи контура чаши, со стыком на самой поверхности. */
export function trimBand(upper: Vec2[], lower: Vec2[], bowl: Vec2[]): { upper: Vec2[]; lower: Vec2[] } {
  if (upper.length < 2 || lower.length !== upper.length || bowl.length < 3) return { upper, lower }
  const inside = (p: Vec2) => pointInPolygon(p, bowl)
  let i = 0
  while (i < upper.length && !inside(upper[i]) && !inside(lower[i])) i++
  if (i >= upper.length) return { upper, lower }
  while (i < upper.length - 1 && (inside(upper[i]) || inside(lower[i]))) i++
  if (i === 0 || inside(upper[i]) || inside(lower[i])) return { upper, lower }
  const prev = i - 1
  return {
    upper: [crossOut(upper[prev], upper[i], inside), ...upper.slice(i)],
    lower: [crossOut(lower[prev], lower[i], inside), ...lower.slice(i)],
  }
}
