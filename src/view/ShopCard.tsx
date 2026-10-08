import type { PipeDesign, Units } from '../domain/types'
import type { Calc } from '../domain/calculator'
import { formatLen } from '../domain/format'
import { bendLabel } from '../domain/shapes'
import { woodById } from '../domain/woods'
import type { ProcessStep } from '../domain/process'

interface Props {
  design: PipeDesign
  calc: Calc
  units: Units
  steps: ProcessStep[]
}

export function ShopCard({ design, calc, units, steps }: Props) {
  const wood = woodById(design.woodId)
  const drill = steps.find((s) => s.id === 'mortise-airway' || s.id === 'kit')
  return (
    <article className="card-sheet">
      <header>
        <h2>{design.name}</h2>
        <p>
          {wood.name} · {design.grain === 'plateau' ? 'плато' : 'эбошон'} · изгиб {bendLabel(design.bend)}
        </p>
      </header>
      <dl>
        <div>
          <dt>Чаша</dt>
          <dd>
            {formatLen(design.bowlHeight, units, 0)} × ⌀ {formatLen(design.bowlDiameter, units)}
          </dd>
        </div>
        <div>
          <dt>Камера</dt>
          <dd>
            ⌀ {formatLen(design.chamberDiameter, units)} × {formatLen(design.chamberDepth, units, 0)} · {calc.chamberVolumeMl.toFixed(1)} мл
          </dd>
        </div>
        <div>
          <dt>Канал</dt>
          <dd>
            ⌀ {formatLen(design.airwayDiameter, units)} · {formatLen(calc.airwayLength, units, 0)} · {calc.layout.drillAngleDeg.toFixed(0)}°
          </dd>
        </div>
        <div>
          <dt>Гнездо</dt>
          <dd>
            ⌀ {formatLen(design.mortiseDiameter, units)} × {formatLen(design.mortiseDepth, units, 0)}
          </dd>
        </div>
        <div>
          <dt>Цапфа</dt>
          <dd>
            {formatLen(calc.tenonLength, units, 0)}, зазор {formatLen(design.tenonGap, units)}
          </dd>
        </div>
        <div>
          <dt>Мундштук</dt>
          <dd>
            {formatLen(design.stemLength, units, 0)}, щель {formatLen(design.slotDepth, units, 0)}
          </dd>
        </div>
        <div>
          <dt>Брусок</dt>
          <dd>
            {Math.ceil(calc.block.length)} × {Math.ceil(calc.block.width)} × {Math.ceil(calc.block.height)} мм
          </dd>
        </div>
        <div>
          <dt>Свёрла</dt>
          <dd>
            {calc.bits.chamber}. Канал: {calc.bits.airway}. Гнездо: {calc.bits.mortise}.
          </dd>
        </div>
      </dl>
      <p className="card-order">
        {drill?.id === 'kit'
          ? 'Отверстия уже в бруске. Форму веди по ним, камеру заново не сверли.'
          : 'Порядок: канал и гнездо, затем камера. Камеру останови за 3 мм до канала и только потом соединяй.'}
      </p>
      <button type="button" className="print-btn" onClick={() => window.print()}>
        Печать карточки
      </button>
    </article>
  )
}
