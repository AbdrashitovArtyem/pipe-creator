import { useEffect, useMemo, useRef, useState } from 'react'
import type { PartId, PipeDesign, Units } from './domain/types'
import { PARTS } from './domain/types'
import { uid } from './domain/format'
import { WOODS, woodById } from './domain/woods'
import { SHAPES, bendLabel, designFromShape } from './domain/shapes'
import { AIRWAY_BIT_OPTIONS, TOOL_FIELDS, type ToolInventory } from './domain/tools'
import { calculate } from './domain/calculator'
import { driftFromPreset, evaluate } from './domain/checks'
import { buildProcess } from './domain/process'
import { describePart } from './domain/parts'
import { applyBlank, sizeLimits } from './domain/blank'
import { loadState, newProject, saveState, touchProject, type Persisted, type Project } from './domain/storage'
import { loadWorkshop, savedSession, saveWorkshop, storeSession, type Session } from './domain/account'
import { PipeScene, type StageView } from './view/PipeScene'
import { Drawing } from './view/Drawing'
import { ShopCard } from './view/ShopCard'
import { Wizard } from './view/Wizard'
import { BowlShapeFields, ShankShapeFields } from './view/ShapeFields'
import { Num, Select } from './ui/fields'
import { StepBoard } from './view/StepBoard'
import { Account } from './view/Account'

type Panel = 'calc' | 'shapes' | 'sizes' | 'shop'
type ShopTab = 'steps' | 'card' | 'part'
type View = StageView | 'draw'

const VIEWS: { id: View; label: string }[] = [
  { id: 'side', label: 'Сбоку' },
  { id: 'top', label: 'Сверху' },
  { id: 'cut', label: 'Разрез' },
  { id: 'draw', label: 'Чертёж' },
]

export function App() {
  const initial = useMemo(() => loadState(), [])
  const [projects, setProjects] = useState<Project[]>(initial.projects)
  const [activeId, setActiveId] = useState(initial.activeId)
  const [tools, setTools] = useState<ToolInventory>(initial.tools)
  const [units, setUnits] = useState<Units>(initial.units)
  const [part, setPart] = useState<PartId>('bowl')
  const [panel, setPanel] = useState<Panel>('calc')
  const [shop, setShop] = useState<ShopTab>('steps')
  const [view, setView] = useState<View>('side')
  const [showDims, setShowDims] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, string[]>>(initial.progress)
  const [session, setSession] = useState<Session | null>(null)
  const [server, setServer] = useState<'unknown' | 'up' | 'down'>('unknown')
  const fileRef = useRef<HTMLInputElement>(null)

  const project = projects.find((item) => item.id === activeId) ?? projects[0]
  const design = project.design
  const lim = sizeLimits(design)
  const calc = useMemo(() => calculate(design), [design])
  const checks = useMemo(() => evaluate(design, calc), [design, calc])
  const steps = useMemo(() => buildProcess(design, tools, calc), [design, tools, calc])
  const story = describePart(part, design, calc, units)
  const drift = driftFromPreset(design)
  const bad = checks.filter((item) => item.severity === 'bad').length

  useEffect(() => {
    saveState({ projects, activeId: project.id, tools, units, progress })
  }, [projects, project.id, tools, units, progress])

  function applySnapshot(snapshot: Persisted) {
    setProjects(snapshot.projects)
    setActiveId(snapshot.activeId)
    setTools(snapshot.tools)
    setUnits(snapshot.units)
    setProgress(snapshot.progress ?? {})
  }

  useEffect(() => {
    let cancel = false
    fetch('/api/workshop')
      .then((response) => {
        if (!cancel) setServer(response.status === 404 ? 'down' : 'up')
      })
      .catch(() => {
        if (!cancel) setServer('down')
      })
    const token = savedSession()
    if (token) {
      loadWorkshop(token)
        .then((data) => {
          if (cancel) return
          if (data.workshop?.projects?.length) applySnapshot(data.workshop as Persisted)
          setSession({ token, name: data.name })
        })
        .catch(() => storeSession(null))
    }
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const handle = window.setTimeout(() => {
      saveWorkshop(session.token, { projects, activeId: project.id, tools, units, progress }).catch((error: Error) => {
        setNotice(error.message)
      })
    }, 700)
    return () => window.clearTimeout(handle)
  }, [session, projects, project.id, tools, units, progress])

  function changeSession(next: Session | null) {
    storeSession(next?.token ?? null)
    if (!next) {
      setSession(null)
      return
    }
    loadWorkshop(next.token)
      .then((data) => {
        if (data.workshop?.projects?.length) applySnapshot(data.workshop as Persisted)
        setSession({ token: next.token, name: data.name })
      })
      .catch((error: Error) => setNotice(error.message))
  }

  function commit(next: PipeDesign, note?: string) {
    setProjects((list) => list.map((item) => (item.id === next.id ? touchProject(item, next) : item)))
    setNotice(note ?? null)
  }

  function patch(partial: Partial<PipeDesign>, note?: string) {
    const next = { ...design, ...partial }
    const heightChanged = partial.bowlHeight != null && Math.abs(partial.bowlHeight - design.bowlHeight) > 0.05
    const depthUntouched = partial.chamberDepth == null || Math.abs(partial.chamberDepth - design.chamberDepth) < 0.05
    if (heightChanged && depthUntouched && partial.bowlHeight != null) {
      const heel = design.bowlHeight - design.chamberDepth
      next.chamberDepth = partial.bowlHeight - heel
    }
    commit(applyBlank(next), note)
  }

  function chooseShape(shapeId: string) {
    commit(designFromShape(shapeId, design))
  }

  function addProject() {
    const created = newProject(design.shapeId === 'custom' ? 'billiard' : design.shapeId)
    setProjects((list) => [created, ...list])
    setActiveId(created.id)
  }

  function startBlank() {
    const created = newProject('custom')
    setProjects((list) => [created, ...list])
    setActiveId(created.id)
    setPanel('calc')
    setView('side')
  }

  function duplicate() {
    const copy: PipeDesign = { ...design, id: uid(), name: `${design.name} копия` }
    const created: Project = { id: copy.id, name: copy.name, design: copy, updatedAt: Date.now() }
    setProjects((list) => [created, ...list])
    setActiveId(created.id)
  }

  function removeProject(id: string) {
    setProjects((list) => {
      const next = list.filter((item) => item.id !== id)
      if (!next.length) {
        const created = newProject()
        setActiveId(created.id)
        return [created]
      }
      if (id === project.id) setActiveId(next[0].id)
      return next
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ projects, tools, units }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trubki.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file: File) {
    file
      .text()
      .then((text) => {
        const data = JSON.parse(text) as { projects?: Project[]; tools?: ToolInventory; units?: Units }
        if (!data.projects?.length) return
        setProjects(data.projects)
        setActiveId(data.projects[0].id)
        if (data.tools) setTools({ ...tools, ...data.tools })
        if (data.units) setUnits(data.units)
      })
      .catch(() => setNotice('Файл не читается'))
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">Мастерская</p>
          <strong>Трубки</strong>
        </div>
        <input className="name" value={design.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Название" />
        <div className="top-actions">
          <label className="units">
            <span>Единицы</span>
            <select value={units} onChange={(e) => setUnits(e.target.value as Units)}>
              <option value="mm">мм</option>
              <option value="in">дюймы</option>
            </select>
          </label>
          <Account session={session} server={server} onSession={changeSession} onNotice={setNotice} />
          <button type="button" onClick={exportJson}>
            Экспорт
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Импорт
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importJson(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {notice && <p className="notice">{notice}</p>}

      <div className="workspace">
        <main className="stage">
          <div className="stage-bar">
            <div className="view-switch" role="tablist" aria-label="Вид">
              {VIEWS.map((item) => (
                <button key={item.id} type="button" className={view === item.id ? 'on' : ''} onClick={() => setView(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} />
              Канал
            </label>
          </div>
          <div className="facts">
            <span>камера {calc.chamberVolumeMl.toFixed(1)} мл</span>
            <span>стенка {calc.layout.rimWall.toFixed(1)} мм</span>
            <span>к чаше {calc.layout.shankAngleDeg.toFixed(0)}°</span>
            <span>пятка {(design.bowlHeight - design.chamberDepth).toFixed(0)} мм</span>
          </div>
          {view === 'draw' ? (
            <div className="stage-sheet">
              <Drawing design={design} calc={calc} units={units} />
            </div>
          ) : (
            <PipeScene
              design={design}
              view={view}
              showDims={showDims}
              selected={part}
              onSelect={(id) => {
                setPart(id)
                setPanel('shop')
                setShop('part')
              }}
              onChange={patch}
            />
          )}
          {view !== 'draw' && view !== 'top' && (
            <p className="hint">Золотые точки тянут высоту чаши, длину чубука, его угол к чаше и мундштук. Чубук прямой.</p>
          )}
          {view === 'top' && <p className="hint">Кольцо вокруг тёмной камеры — толщина стенки у кромки.</p>}
        </main>

        <aside className="panel">
          <div className="panel-tabs">
            {(
              [
                ['calc', 'Калькулятор'],
                ['shapes', 'Формы'],
                ['sizes', 'Размеры'],
                ['shop', 'Цех'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={panel === id ? 'on' : ''} onClick={() => setPanel(id)}>
                {label}
                {id === 'shop' && bad > 0 ? ` · ${bad}` : ''}
              </button>
            ))}
          </div>
          <div className="panel-body">
            <div hidden={panel !== 'calc'}>
              <Wizard design={design} units={units} calc={calc} onChange={patch} onBlank={startBlank} />
            </div>

            {panel === 'shapes' && (
              <>
                <section>
                  <h2>Готовая форма</h2>
                  <div className="shape-grid">
                    {SHAPES.map((shape) => (
                      <button key={shape.id} type="button" className={shape.id === design.shapeId ? 'shape on' : 'shape'} onClick={() => chooseShape(shape.id)}>
                        <strong>{shape.name}</strong>
                        <span>{shape.hint}</span>
                      </button>
                    ))}
                  </div>
                  {drift.length > 0 && <p className="drift">От пресета: {drift.join('; ')}</p>}
                </section>
                <section>
                  <h2>Дерево</h2>
                  <div className="wood-list">
                    {WOODS.map((wood) => (
                      <button key={wood.id} type="button" className={wood.id === design.woodId ? 'wood-pick on' : 'wood-pick'} onClick={() => patch({ woodId: wood.id })}>
                        <i style={{ background: wood.color }} />
                        <span>
                          <strong>
                            {wood.name}
                            {wood.experimental ? ' · проба' : ''}
                          </strong>
                          <em>
                            жар {wood.heat}/5 · стенка от {wood.minWall.toLocaleString('ru-RU')} мм
                          </em>
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="soft">{woodById(design.woodId).note}</p>
                </section>
                <section>
                  <h2>Проекты</h2>
                  <div className="row">
                    <button type="button" onClick={startBlank}>
                      С нуля
                    </button>
                    <button type="button" onClick={addProject}>
                      Ещё одна
                    </button>
                    <button type="button" onClick={duplicate}>
                      Копия
                    </button>
                  </div>
                  <ul className="projects">
                    {projects.map((item) => (
                      <li key={item.id}>
                        <button type="button" className={item.id === project.id ? 'on' : ''} onClick={() => setActiveId(item.id)}>
                          {item.name}
                        </button>
                        <button type="button" className="quiet" onClick={() => removeProject(item.id)} aria-label="Удалить">
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {panel === 'sizes' && (
              <>
                <h2>Все размеры</h2>
                <h3>Брусок</h3>
                <Num label="Длина бруска" mm={design.blankLength} min={lim.blankLength.min} max={lim.blankLength.max} units={units} onChange={(blankLength) => patch({ blankLength })} />
                <Num label="Ширина бруска" mm={design.blankWidth} min={lim.blankWidth.min} max={lim.blankWidth.max} units={units} onChange={(blankWidth) => patch({ blankWidth })} />
                <Num label="Высота бруска" mm={design.blankHeight} min={lim.blankHeight.min} max={lim.blankHeight.max} units={units} onChange={(blankHeight) => patch({ blankHeight })} />
                <h3>Чаша</h3>
                <BowlShapeFields design={design} units={units} onChange={(next) => patch(next)} />
                <Num label="Высота чаши" mm={design.bowlHeight} min={lim.bowlHeight.min} max={lim.bowlHeight.max} units={units} onChange={(bowlHeight) => patch({ bowlHeight })} hint="меняется верхний край, низ остаётся на чубуке" />
                <Num label="Диаметр чаши" mm={design.bowlDiameter} min={lim.bowlDiameter.min} max={lim.bowlDiameter.max} units={units} onChange={(bowlDiameter) => patch({ bowlDiameter })} hint="минимум от диаметра камеры" />
                <Num label="Наклон чаши" mm={design.cantDeg} min={0} max={12} units="mm" bare suffix="°" onChange={(cantDeg) => patch({ cantDeg })} />
                <h3>Камера и канал</h3>
                <Num label="Диаметр камеры" mm={design.chamberDiameter} min={lim.chamberDiameter.min} max={lim.chamberDiameter.max} units={units} onChange={(chamberDiameter) => patch({ chamberDiameter })} hint="от него растёт минимум чаши" />
                <Num label="Глубина камеры" mm={design.chamberDepth} min={lim.chamberDepth.min} max={lim.chamberDepth.max} units={units} onChange={(chamberDepth) => patch({ chamberDepth })} />
                <Num label="Канал" mm={design.airwayDiameter} min={lim.airwayDiameter.min} max={lim.airwayDiameter.max} units={units} onChange={(airwayDiameter) => patch({ airwayDiameter })} />
                <Num label="Гнездо" mm={design.mortiseDiameter} min={lim.mortiseDiameter.min} max={lim.mortiseDiameter.max} units={units} onChange={(mortiseDiameter) => patch({ mortiseDiameter })} />
                <Num label="Глубина гнезда" mm={design.mortiseDepth} min={lim.mortiseDepth.min} max={lim.mortiseDepth.max} units={units} onChange={(mortiseDepth) => patch({ mortiseDepth })} />
                <h3>Шинка и мундштук</h3>
                <ShankShapeFields design={design} units={units} onChange={(next) => patch(next)} />
                <Num label="Длина шинки" mm={design.shankLength} min={lim.shankLength.min} max={lim.shankLength.max} units={units} onChange={(shankLength) => patch({ shankLength })} hint="максимум — остаток бруска" />
                <Num label="Диаметр шинки" mm={design.shankDiameter} min={lim.shankDiameter.min} max={lim.shankDiameter.max} units={units} onChange={(shankDiameter) => patch({ shankDiameter })} hint="минимум от гнезда" />
                <Num label="Длина мундштука" mm={design.stemLength} min={30} max={320} units={units} onChange={(stemLength) => patch({ stemLength })} />
                <Num label="Зазор цапфы" mm={design.tenonGap} min={0.4} max={2} units={units} onChange={(tenonGap) => patch({ tenonGap })} />
                <Num label="Глубина щели" mm={design.slotDepth} min={8} max={40} units={units} onChange={(slotDepth) => patch({ slotDepth })} />
                <Num label="Высота щели" mm={design.slotHeight} min={0.8} max={2.2} units={units} onChange={(slotHeight) => patch({ slotHeight })} />
                <Num label="Прикус" mm={design.buttonThickness} min={2.8} max={6} units={units} onChange={(buttonThickness) => patch({ buttonThickness })} />
                <Select label="Изгиб" value={design.bend} options={['straight', 'eighth', 'quarter', 'half', 'threeQuarter', 'full'].map((id) => ({ id: id as PipeDesign['bend'], label: bendLabel(id as PipeDesign['bend']) }))} onChange={(bend) => patch({ bend })} />
                <Select
                  label="Мундштук"
                  value={design.stemStyle}
                  options={[
                    { id: 'taper', label: 'конус' },
                    { id: 'saddle', label: 'седло' },
                  ]}
                  onChange={(stemStyle) => patch({ stemStyle })}
                />
                <Select
                  label="Материал мундштука"
                  value={design.stemMaterial}
                  options={[
                    { id: 'vulcanite', label: 'вулканит' },
                    { id: 'cumberland', label: 'камберленд' },
                    { id: 'acrylic', label: 'акрил' },
                  ]}
                  onChange={(stemMaterial) => patch({ stemMaterial })}
                />
                <Select
                  label="Цапфа"
                  value={design.tenonStyle}
                  options={[
                    { id: 'integral', label: 'цельная' },
                    { id: 'delrin', label: 'Delrin' },
                  ]}
                  onChange={(tenonStyle) => patch({ tenonStyle })}
                />
                <Select
                  label="Отделка"
                  value={design.finish}
                  options={[
                    { id: 'smooth', label: 'гладкая' },
                    { id: 'rusticated', label: 'рустикация' },
                    { id: 'sandblast', label: 'пескоструй' },
                  ]}
                  onChange={(finish) => patch({ finish })}
                />
                <Select
                  label="Распил"
                  value={design.grain}
                  options={[
                    { id: 'plateau', label: 'плато' },
                    { id: 'ebauchon', label: 'эбошон' },
                  ]}
                  onChange={(grain) => patch({ grain })}
                />
                <h2>Проверки {bad > 0 ? `· ${bad}` : ''}</h2>
                <ul className="checks">
                  {checks.map((item) => (
                    <li key={item.id} className={item.severity}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </li>
                  ))}
                </ul>
                <p className="volume">
                  Камера {calc.chamberVolumeMl.toFixed(1)} мл, лента примерно {calc.tobaccoLowG.toFixed(1)}–{calc.tobaccoHighG.toFixed(1)} г. Канал{' '}
                  {calc.airwayVolumeMl.toFixed(2)} мл. Брусок {Math.ceil(calc.block.length)}×{Math.ceil(calc.block.width)}×{Math.ceil(calc.block.height)} мм.
                </p>
              </>
            )}

            {panel === 'shop' && (
              <>
                <div className="subtabs">
                  {(
                    [
                      ['steps', 'Шаги'],
                      ['card', 'Карточка'],
                      ['part', 'Деталь'],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} type="button" className={shop === id ? 'on' : ''} onClick={() => setShop(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                {shop === 'steps' && (
                  <>
                    {bad > 0 && <p className="notice">Сначала закрой красные проверки: план сверления сейчас опасен.</p>}
                    <Tools tools={tools} onChange={setTools} airway={design.airwayDiameter} />
                    <StepBoard
                      steps={steps}
                      done={progress[project.id] ?? []}
                      onToggle={(key) => {
                        setProgress((map) => {
                          const list = map[project.id] ?? []
                          const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key]
                          return { ...map, [project.id]: next }
                        })
                      }}
                    />
                  </>
                )}
                {shop === 'card' && <ShopCard design={design} calc={calc} units={units} steps={steps} />}
                {shop === 'part' && (
                  <article className="story">
                    <div className="chips">
                      {PARTS.map((item) => (
                        <button key={item.id} type="button" className={part === item.id ? 'on' : ''} onClick={() => setPart(item.id)}>
                          {item.title}
                        </button>
                      ))}
                    </div>
                    <h2>{story.title}</h2>
                    <p>{story.role}</p>
                    <dl>
                      {story.facts.map((fact) => (
                        <div key={fact.label}>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
      <div className="print-only">
        <Drawing design={design} calc={calc} units={units} />
        <ShopCard design={design} calc={calc} units={units} steps={steps} />
      </div>
    </div>
  )
}

function Tools({ tools, onChange, airway }: { tools: ToolInventory; onChange: (tools: ToolInventory) => void; airway: number }) {
  function toggle(key: keyof ToolInventory) {
    onChange({ ...tools, [key]: !tools[key] })
  }
  return (
    <div className="tools">
      <h2>Что есть на верстаке</h2>
      <div className="tool-grid">
        {TOOL_FIELDS.map((field) => (
          <label key={field.key} className="check" title={field.hint}>
            <input type="checkbox" checked={Boolean(tools[field.key])} onChange={() => toggle(field.key)} />
            {field.label}
          </label>
        ))}
      </div>
      <Select
        label="Сверло камеры"
        value={tools.chamberBit}
        options={[
          { id: 'none', label: 'нет' },
          { id: 'spade', label: 'переточенное перо' },
          { id: 'spoon', label: 'ложечное' },
          { id: 'burr', label: 'шарошка' },
        ]}
        onChange={(chamberBit) => onChange({ ...tools, chamberBit })}
      />
      <Select
        label="Сверло гнезда"
        value={tools.mortiseBit}
        options={[
          { id: 'forstner', label: 'Форстнер' },
          { id: 'brad', label: 'с шипом' },
          { id: 'endmill', label: 'фреза' },
        ]}
        onChange={(mortiseBit) => onChange({ ...tools, mortiseBit })}
      />
      <Select
        label="Проточка цапфы"
        value={tools.tenonTool}
        options={[
          { id: 'none', label: 'нет' },
          { id: 'pimo', label: 'Pimo' },
          { id: 'lathe', label: 'токарный по металлу' },
        ]}
        onChange={(tenonTool) => onChange({ ...tools, tenonTool })}
      />
      <fieldset>
        <legend>Свёрла канала в ящике</legend>
        {AIRWAY_BIT_OPTIONS.map((bit) => (
          <label key={bit} className="check">
            <input
              type="checkbox"
              checked={tools.airwayBits.some((owned) => Math.abs(owned - bit) < 0.05)}
              onChange={() => {
                const has = tools.airwayBits.some((owned) => Math.abs(owned - bit) < 0.05)
                const airwayBits = has ? tools.airwayBits.filter((owned) => Math.abs(owned - bit) >= 0.05) : [...tools.airwayBits, bit]
                onChange({ ...tools, airwayBits })
              }}
            />
            {bit.toLocaleString('ru-RU')} мм{Math.abs(bit - airway) < 0.15 ? ' · нужно сейчас' : ''}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
