import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { PartId, PipeDesign } from '../domain/types'
import { bendDegrees, bendFromDegrees, handlePositions } from '../domain/geometry'
import { sizeLimits } from '../domain/blank'
import { woodById } from '../domain/woods'
import { buildPipeGeometries, disposeGeometries, type PipeGeometries } from './geometries'

const STEM_COLOR = {
  vulcanite: '#2a2420',
  acrylic: '#d9d0c4',
  cumberland: '#7a3834',
} as const

export type StageView = 'side' | 'top' | 'cut'

interface SceneProps {
  design: PipeDesign
  view: StageView
  showDims: boolean
  selected: PartId | null
  onSelect: (id: PartId) => void
  onChange: (patch: Partial<PipeDesign>, notice?: string) => void
}

export function PipeScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [70, 36, 210], fov: 32, near: 0.1, far: 4000 }}
      gl={{ localClippingEnabled: true, antialias: true }}
    >
      <color attach="background" args={['#f3eee6']} />
      <SceneBody {...props} />
    </Canvas>
  )
}

function SceneBody({ design, view, showDims, selected, onSelect, onChange }: SceneProps) {
  const geos = useMemo(() => buildPipeGeometries(design), [design])
  useEffect(() => () => disposeGeometries(geos), [geos])
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.2)], [])
  const section = view === 'cut'
  const planes = section ? clip : []
  const wood = woodById(design.woodId)
  const [dragging, setDragging] = useState(false)
  const layout = geos.layout
  const midX = (layout.bounds.minX + layout.bounds.maxX) / 2
  const midY = (layout.bounds.minY + layout.bounds.maxY) / 2
  const span = Math.max(layout.bounds.maxX - layout.bounds.minX, layout.bounds.maxY - layout.bounds.minY, 80)
  const inner = design.chamberDiameter / 2
  const outer = inner + layout.rimWall

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[40, 90, 80]} intensity={1.55} color="#fff8ee" />
      <directionalLight position={[-70, 40, 30]} intensity={0.45} color="#d9c7aa" />
      <PipeMeshes
        geos={geos}
        woodColor={wood.color}
        stemColor={STEM_COLOR[design.stemMaterial]}
        planes={planes}
        section={section}
        faceted={design.shankSection === 'diamond' || design.shankSection === 'square'}
        selected={selected}
        onSelect={onSelect}
      />
      {showDims && view !== 'top' && (
        <Line
          points={layout.airway.map((p) => [p.x, p.y, 3] as [number, number, number])}
          color="#9a3412"
          lineWidth={1.5}
        />
      )}
      {view === 'top' && (
        <>
          <Line
            points={[
              [layout.rimCenter.x, layout.rimCenter.y + 0.8, inner],
              [layout.rimCenter.x, layout.rimCenter.y + 0.8, outer],
            ]}
            color="#9a3412"
            lineWidth={2}
          />
          <Html position={[layout.rimCenter.x, layout.rimCenter.y + 1.4, (inner + outer) / 2]} center>
            <div className="wall-tag">стенка {layout.rimWall.toFixed(1)} мм</div>
          </Html>
        </>
      )}
      {view !== 'top' && <Handles design={design} geos={geos} onChange={onChange} onDrag={setDragging} />}
      <OrbitControls makeDefault enabled={!dragging} target={[view === 'top' ? layout.rimCenter.x : midX, view === 'top' ? layout.rimCenter.y : midY, 0]} />
      <Frame
        view={view}
        span={span}
        midX={midX}
        midY={midY}
        rimX={layout.rimCenter.x}
        rimY={layout.rimCenter.y}
        bowl={design.bowlDiameter}
        fitKey={`${design.shapeId}:${design.bend}:${view}`}
      />
    </>
  )
}

function Frame({
  view,
  span,
  midX,
  midY,
  rimX,
  rimY,
  bowl,
  fitKey,
}: {
  view: StageView
  span: number
  midX: number
  midY: number
  rimX: number
  rimY: number
  bowl: number
  fitKey: string
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls as { target: THREE.Vector3; update: () => void } | null)
  const fitted = useRef('')
  useEffect(() => {
    if (!controls || fitted.current === fitKey) return
    fitted.current = fitKey
    if (view === 'top') {
      const dist = Math.max(bowl * 2.8, 90)
      camera.up.set(0, 0, -1)
      camera.position.set(rimX, rimY + dist, 0.4)
      camera.lookAt(rimX, rimY, 0)
      controls.target.set(rimX, rimY, 0)
    } else {
      camera.up.set(0, 1, 0)
      camera.position.set(midX, midY, Math.max(span * 1.75, 200))
      camera.lookAt(midX, midY, 0)
      controls.target.set(midX, midY, 0)
    }
    controls.update()
  }, [fitKey, view, span, midX, midY, rimX, rimY, bowl, camera, controls])
  return null
}

function PipeMeshes({
  geos,
  woodColor,
  stemColor,
  planes,
  section,
  faceted,
  selected,
  onSelect,
}: {
  geos: PipeGeometries
  woodColor: string
  stemColor: string
  planes: THREE.Plane[]
  section: boolean
  faceted: boolean
  selected: PartId | null
  onSelect: (id: PartId) => void
}) {
  const wood = (part: PartId) => (selected === part ? lift(woodColor) : woodColor)
  const side = section ? THREE.DoubleSide : THREE.FrontSide
  return (
    <group>
      <mesh geometry={geos.bowl} onClick={(e) => pick(e, 'bowl', onSelect)}>
        <meshStandardMaterial color={wood('bowl')} roughness={0.62} metalness={0.02} clippingPlanes={planes} side={side} flatShading={faceted} />
      </mesh>
      <mesh geometry={geos.rim} onClick={(e) => pick(e, 'bowl', onSelect)}>
        <meshStandardMaterial color={wood('bowl')} roughness={0.55} metalness={0.02} clippingPlanes={planes} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.shank} onClick={(e) => pick(e, 'shank', onSelect)}>
        <meshStandardMaterial color={wood('shank')} roughness={0.62} metalness={0.02} clippingPlanes={planes} side={side} flatShading={faceted} />
      </mesh>
      <mesh geometry={geos.stem} onClick={(e) => pick(e, 'stem', onSelect)}>
        <meshStandardMaterial
          color={selected === 'stem' || selected === 'button' || selected === 'slot' ? '#d7c4a4' : stemColor}
          roughness={0.38}
          metalness={0.06}
          clippingPlanes={planes}
          side={THREE.DoubleSide}
          flatShading={faceted}
        />
      </mesh>
      <mesh geometry={geos.slot} onClick={(e) => pick(e, 'slot', onSelect)}>
        <meshStandardMaterial color="#070605" roughness={1} metalness={0} clippingPlanes={planes} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.chamber} onClick={(e) => pick(e, 'chamber', onSelect)}>
        <meshStandardMaterial color="#1a1410" roughness={0.92} side={THREE.DoubleSide} clippingPlanes={planes} />
      </mesh>
      {section && (
        <group>
          <mesh geometry={geos.airway} onClick={(e) => pick(e, 'airway', onSelect)}>
            <meshStandardMaterial color="#0c0a09" roughness={0.8} side={THREE.DoubleSide} clippingPlanes={planes} />
          </mesh>
          <mesh geometry={geos.mortise} onClick={(e) => pick(e, 'mortise', onSelect)}>
            <meshStandardMaterial color="#1a120e" roughness={1} side={THREE.DoubleSide} clippingPlanes={planes} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function pick(e: ThreeEvent<MouseEvent>, id: PartId, onSelect: (id: PartId) => void) {
  e.stopPropagation()
  onSelect(id)
}

function lift(hex: string): string {
  const c = new THREE.Color(hex)
  c.offsetHSL(0.02, 0.05, 0.08)
  return `#${c.getHexString()}`
}

function Handles({
  design,
  geos,
  onChange,
  onDrag,
}: {
  design: PipeDesign
  geos: PipeGeometries
  onChange: (patch: Partial<PipeDesign>, notice?: string) => void
  onDrag: (v: boolean) => void
}) {
  const handles = handlePositions(design, geos.layout)
  const snap = useRef(design)
  const begin = () => {
    snap.current = design
    onDrag(true)
  }
  const end = () => onDrag(false)
  return (
    <group>
      <DragHandle
        position={handles.bowl}
        onBegin={begin}
        onEnd={end}
        onLive={(_dx, dy) => {
          const base = snap.current
          const lim = sizeLimits(base)
          const heel = base.bowlHeight - base.chamberDepth
          const floor = Math.max(20, heel + 12)
          const raw = base.bowlHeight + dy
          if (raw > lim.bowlHeight.max - 0.05) {
            onChange({ bowlHeight: round1(lim.bowlHeight.max) }, 'Высота упёрлась в брусок')
            return
          }
          if (raw < floor) {
            onChange({ bowlHeight: round1(floor) }, 'Высота упёрлась в камеру: под дном нужна стенка')
            return
          }
          onChange({ bowlHeight: round1(raw) })
        }}
      />
      <DragHandle
        position={handles.shank}
        onBegin={begin}
        onEnd={end}
        onLive={(dx) => {
          const lim = sizeLimits(snap.current)
          const next = clampNum(snap.current.shankLength + dx, lim.shankLength.min, lim.shankLength.max)
          onChange({ shankLength: round1(next) })
        }}
      />
      <DragHandle
        position={handles.bend}
        onBegin={begin}
        onEnd={end}
        onLive={(_dx, dy) => {
          const deg = bendDegrees(snap.current.bend) - dy * 0.85
          onChange({ bend: bendFromDegrees(clampNum(deg, 22, 90)) })
        }}
      />
      <DragHandle
        position={handles.stem}
        onBegin={begin}
        onEnd={end}
        onLive={(dx, dy) => {
          const next = clampNum(snap.current.stemLength + dx - dy * 0.2, 30, 320)
          onChange({ stemLength: round1(next) })
        }}
      />
    </group>
  )
}

function DragHandle({
  position,
  onBegin,
  onEnd,
  onLive,
}: {
  position: { x: number; y: number }
  onBegin: () => void
  onEnd: () => void
  onLive: (dx: number, dy: number) => void
}) {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useRef(new THREE.Vector3())
  return (
    <mesh
      position={[position.x, position.y, 8]}
      onPointerDown={(e) => {
        e.stopPropagation()
        const node = e.nativeEvent.target as Element | null
        node?.setPointerCapture?.(e.pointerId)
        e.ray.intersectPlane(plane, hit.current)
        origin.current = { x: hit.current.x, y: hit.current.y }
        onBegin()
      }}
      onPointerMove={(e) => {
        if (!origin.current) return
        e.stopPropagation()
        e.ray.intersectPlane(plane, hit.current)
        onLive(hit.current.x - origin.current.x, hit.current.y - origin.current.y)
      }}
      onPointerUp={() => {
        origin.current = null
        onEnd()
      }}
    >
      <sphereGeometry args={[3.2, 18, 18]} />
      <meshStandardMaterial color="#c2410c" emissive="#9a3412" emissiveIntensity={0.25} />
    </mesh>
  )
}

function clampNum(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
