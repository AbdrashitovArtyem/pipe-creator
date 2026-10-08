import { useEffect, useState } from 'react'
import type { PipeDesign, Units } from '../domain/types'
import type { Calc } from '../domain/calculator'
import { applyBlank, BLANK_RANGE, sizeLimits } from '../domain/blank'
import { BEND_ORDER, bendLabel } from '../domain/shapes'
import { WOODS, woodById } from '../domain/woods'
import { formatLen } from '../domain/format'
import { Num } from '../ui/fields'
import { downloadTemplate } from './templateSvg'
import { BowlShapeFields, ShankShapeFields } from './ShapeFields'

const STEPS = ['Брусок', 'Каналы', 'Чаша', 'Шинка', 'Мундштук']

interface Props {
  design: PipeDesign
  units: Units
  calc: Calc
  onChange: (patch: Partial<PipeDesign>, notice?: string) => void
  onBlank: () => void
}

export function Wizard({ design, units, calc, onChange, onBlank }: Props) {
  const [step, setStep] = useState(0)
  const [projectId, setProjectId] = useState(design.id)
  const [blank, setBlank] = useState<{ length: number | null; width: number | null; height: number | null }>({
    length: null,
    width: null,
    height: null,
  })
  if (projectId !== design.id) {
    setProjectId(design.id)
    setStep(0)
    setBlank({ length: null, width: null, height: null })
  }
  const ready = blank.length != null && blank.width != null && blank.height != null
  useEffect(() => {
    setBlank((prev) => {
      if (prev.length == null || prev.width == null || prev.height == null) return prev
      if (prev.length === design.blankLength && prev.width === design.blankWidth && prev.height === design.blankHeight) return prev
      return { length: design.blankLength, width: design.blankWidth, height: design.blankHeight }
    })
  }, [design.blankLength, design.blankWidth, design.blankHeight])
  const wall = calc.layout.rimWall
  const heel = design.bowlHeight - design.chamberDepth
  const lim = sizeLimits(design)
  const woodWall = woodById(design.woodId).minWall

  function fit(patch: Partial<typeof design>) {
    onChange(applyBlank({ ...design, ...patch }))
  }

  function setBlankDim(key: 'length' | 'width' | 'height', value: number) {
    const next = { ...blank, [key]: value }
    setBlank(next)
    if (next.length == null || next.width == null || next.height == null) return
    fit({ blankLength: next.length, blankWidth: next.width, blankHeight: next.height })
  }

  function setWall(next: number) {
    const target = Math.max(woodWall, next)
    const need = design.chamberDiameter + 2 * target
    if (need >= design.bowlDiameter) fit({ bowlDiameter: need })
    else fit({ chamberDiameter: round1(design.bowlDiameter - 2 * target) })
  }

  return (
    <div className="wizard">
      <div className="wizard-head">
        <div>
          <h2>Своя трубка</h2>
          <p>Сначала брусок и порода, поля размеров пустые. Потом отверстия. Наружная чаша считается после них: с куска можно снять больше дерева, чем займёт готовая трубка.</p>
        </div>
        <button type="button" className="primary" onClick={onBlank}>
          С нуля
        </button>
      </div>
      {design.shapeId !== 'custom' && (
        <p className="soft">
          Сейчас открыта форма «{design.name}». «С нуля» начнёт отдельный проект и не затрёт её.
        </p>
      )}
      <div className="stepper" role="tablist">
        {STEPS.map((label, index) => (
          <button key={label} type="button" className={index === step ? 'on' : ''} disabled={index > 0 && !ready} onClick={() => setStep(index)}>
            <b>{index + 1}</b>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <section className="step-card">
          <h3>Брусок на столе</h3>
          <p>Длина вдоль будущей шинки, ширина и высота — как у куска. Мундштук точится из отдельного прутка и сюда не входит. Порода задаёт, сколько дерева обязано остаться вокруг отверстий.</p>
          <div className="field-grid">
            <Num label="Длина бруска" mm={blank.length} min={BLANK_RANGE.length.min} max={BLANK_RANGE.length.max} units={units} onChange={(blankLength) => setBlankDim('length', blankLength)} />
            <Num label="Ширина бруска" mm={blank.width} min={BLANK_RANGE.width.min} max={BLANK_RANGE.width.max} units={units} onChange={(blankWidth) => setBlankDim('width', blankWidth)} />
            <Num label="Высота бруска" mm={blank.height} min={BLANK_RANGE.height.min} max={BLANK_RANGE.height.max} units={units} onChange={(blankHeight) => setBlankDim('height', blankHeight)} />
          </div>
          <p className="field-label">Порода</p>
          <div className="wood-list">
            {WOODS.map((wood) => (
              <button key={wood.id} type="button" className={wood.id === design.woodId ? 'wood-pick on' : 'wood-pick'} onClick={() => onChange({ woodId: wood.id })}>
                <i style={{ background: wood.color }} />
                <span>
                  <strong>
                    {wood.name}
                    {wood.experimental ? ' · проба' : ''}
                  </strong>
                  <em>стенка от {wood.minWall.toLocaleString('ru-RU')} мм</em>
                </span>
              </button>
            ))}
          </div>
          <p className="soft">{woodById(design.woodId).note}</p>
          {!ready && <p className="soft">Введите все три размера. Дальше откроются каналы, и только потом наружная чаша.</p>}
          {ready && (
            <p className="soft">
              Кусок не выше {formatLen(lim.bowlHeight.max, units, 0)} и не шире {formatLen(lim.bowlDiameter.max, units, 0)}. Это потолок: чашу можно выточить меньше, когда будут известны отверстия.
            </p>
          )}
          <button type="button" onClick={() => downloadTemplate(design, calc)}>
            Скачать развёртку 1:1
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="step-card">
          <h3>Отверстия</h3>
          <p>
            Сначала камера, дымовой канал и гнездо. Вокруг камеры остаётся не меньше {formatLen(woodWall, units)} дерева. Глубже и шире, чем позволяет брусок, отверстие не ставится. Наружный размер чаши отсюда ещё не берётся.
          </p>
          <div className="field-grid">
            <Num
              label="Диаметр камеры"
              mm={design.chamberDiameter}
              min={lim.chamberDiameter.min}
              max={lim.chamberDiameter.max}
              units={units}
              onChange={(chamberDiameter) => fit({ chamberDiameter })}
              hint={`не шире бруска: до ${formatLen(lim.chamberDiameter.max, units)}`}
            />
            <Num
              label="Глубина камеры"
              mm={design.chamberDepth}
              min={lim.chamberDepth.min}
              max={lim.chamberDepth.max}
              units={units}
              onChange={(chamberDepth) => fit({ chamberDepth })}
              hint={`под дном стенка ${formatLen(woodWall, units)}, от бруска до ${formatLen(lim.chamberDepth.max, units, 0)}`}
            />
            <Num label="Канал" mm={design.airwayDiameter} min={lim.airwayDiameter.min} max={lim.airwayDiameter.max} units={units} onChange={(airwayDiameter) => fit({ airwayDiameter })} />
            <Num label="Гнездо" mm={design.mortiseDiameter} min={lim.mortiseDiameter.min} max={lim.mortiseDiameter.max} units={units} onChange={(mortiseDiameter) => fit({ mortiseDiameter })} />
            <Num label="Глубина гнезда" mm={design.mortiseDepth} min={lim.mortiseDepth.min} max={lim.mortiseDepth.max} units={units} onChange={(mortiseDepth) => fit({ mortiseDepth })} />
          </div>
          <ul className="result">
            <li>Диаметр камеры {formatLen(design.chamberDiameter, units)}</li>
            <li>Объём {calc.chamberVolumeMl.toFixed(1)} мл</li>
            <li>Канал {formatLen(design.airwayDiameter, units)}, гнездо {formatLen(design.mortiseDiameter, units)} × {formatLen(design.mortiseDepth, units, 0)}</li>
          </ul>
        </section>
      )}

      {step === 2 && (
        <section className="step-card">
          <h3>Чаша</h3>
          <p>
            Брусок — верхняя граница. Нижняя — отверстие плюс стенка {formatLen(woodWall, units)}. Высота двигает верхний край: низ чаши остаётся на нижней точке чубука.
          </p>
          <BowlShapeFields design={design} units={units} onChange={onChange} />
          <div className="field-grid">
            <Num label="Высота" mm={design.bowlHeight} min={lim.bowlHeight.min} max={lim.bowlHeight.max} units={units} onChange={(bowlHeight) => fit({ bowlHeight })} hint={`от ${formatLen(lim.bowlHeight.min, units)} до бруска ${formatLen(lim.bowlHeight.max, units, 0)}`} />
            <Num label="Диаметр" mm={design.bowlDiameter} min={lim.bowlDiameter.min} max={lim.bowlDiameter.max} units={units} onChange={(bowlDiameter) => fit({ bowlDiameter })} hint={`от ${formatLen(lim.bowlDiameter.min, units)} до бруска ${formatLen(lim.bowlDiameter.max, units, 0)}`} />
            <Num label="Наклон вперёд" mm={design.cantDeg} min={0} max={12} units="mm" bare suffix="°" onChange={(cantDeg) => onChange({ cantDeg })} />
            <Num
              label="Толщина стенки"
              mm={wall}
              min={woodWall}
              max={Math.max(woodWall, (lim.bowlDiameter.max - design.chamberDiameter) / 2)}
              units={units}
              onChange={setWall}
              hint={`у кромки сейчас ${formatLen(wall, units)}`}
            />
          </div>
          <ul className="result">
            <li>Дерева под дном {formatLen(Math.max(0, heel), units, 0)}</li>
            <li>Можно снять по диаметру до {formatLen(Math.max(0, design.blankWidth - design.bowlDiameter), units, 0)}</li>
          </ul>
        </section>
      )}

      {step === 3 && (
        <section className="step-card">
          <h3>Шинка и изгиб</h3>
          <p>Чубук из бриара прямой, его не гнут. Диаметр не меньше уже введённого гнезда: вокруг отверстия остаётся дерево. Изгиб — это дуга мундштука, она на следующем шаге.</p>
          <ShankShapeFields design={design} units={units} onChange={(patch) => fit(patch)} />
          <div className="field-grid">
            <Num label="Длина шинки" mm={design.shankLength} min={lim.shankLength.min} max={lim.shankLength.max} units={units} onChange={(shankLength) => fit({ shankLength })} hint="максимум — остаток бруска после чаши" />
            <Num label="Диаметр шинки" mm={design.shankDiameter} min={lim.shankDiameter.min} max={lim.shankDiameter.max} units={units} onChange={(shankDiameter) => fit({ shankDiameter })} hint="минимум от гнезда, максимум — брусок" />
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="step-card">
          <h3>Мундштук</h3>
          <p>
            Пруток в брусок не входит. Чубук остаётся прямым, гнётся сам мундштук: чем меньше угол к чаше, тем сильнее чубук задран и тем круче дуга к горизонтали у губ. У полного изгиба угол около 28°.
          </p>
          <p className="field-label">Изгиб</p>
          <div className="chips">
            {BEND_ORDER.map((id) => (
              <button key={id} type="button" className={design.bend === id ? 'on' : ''} onClick={() => onChange({ bend: id })}>
                {bendLabel(id)}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <Num label="Длина" mm={design.stemLength} min={30} max={320} units={units} onChange={(stemLength) => onChange({ stemLength })} />
          </div>
          <p className="soft">
            {design.bend === 'straight' || !Number.isFinite(calc.layout.bendRadius)
              ? 'Мундштук прямой, в одну линию с чубуком.'
              : `Дуга мундштука радиусом ${formatLen(calc.layout.bendRadius, units, 0)}. Прикус выходит к горизонтали.`}
          </p>
          <p className="field-label">Форма</p>
          <div className="chips">
            <button type="button" className={design.stemStyle === 'taper' ? 'on' : ''} onClick={() => onChange({ stemStyle: 'taper' })}>
              Конус
            </button>
            <button type="button" className={design.stemStyle === 'saddle' ? 'on' : ''} onClick={() => onChange({ stemStyle: 'saddle' })}>
              Седло
            </button>
          </div>
          <p className="field-label">Материал</p>
          <div className="chips">
            {(
              [
                ['vulcanite', 'Вулканит'],
                ['cumberland', 'Камберленд'],
                ['acrylic', 'Акрил'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={design.stemMaterial === id ? 'on' : ''} onClick={() => onChange({ stemMaterial: id })}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="wizard-nav">
        <button type="button" disabled={step === 0} onClick={() => setStep((n) => Math.max(0, n - 1))}>
          Назад
        </button>
        <button type="button" className="primary" disabled={step === STEPS.length - 1 || (step === 0 && !ready)} onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}>
          Дальше
        </button>
      </div>
      {ready && (
        <p className="volume">
          Брусок {design.blankLength}×{design.blankWidth}×{design.blankHeight} мм, чаше с шинкой нужно около {Math.ceil(calc.block.length)}×{Math.ceil(calc.block.width)}×{Math.ceil(calc.block.height)} мм. Канал{' '}
          {formatLen(design.airwayDiameter, units)}, угол чубука к чаше {calc.layout.shankAngleDeg.toFixed(0)}°.
        </p>
      )}
    </div>
  )
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
