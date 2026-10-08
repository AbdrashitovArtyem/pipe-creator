import type { BowlProfile, PipeDesign, ShankSection, Units } from '../domain/types'
import { derivedKnobs } from '../domain/shapes'
import { Num } from '../ui/fields'

const PROFILES: { id: BowlProfile; label: string }[] = [
  { id: 'cylinder', label: 'Цилиндр' },
  { id: 'cone', label: 'Конус' },
  { id: 'apple', label: 'Яблоко' },
  { id: 'egg', label: 'Яйцо' },
  { id: 'brandy', label: 'Бренди' },
]

const SECTIONS: { id: ShankSection; label: string }[] = [
  { id: 'round', label: 'Круг' },
  { id: 'oval', label: 'Овал' },
  { id: 'diamond', label: 'Ромб' },
  { id: 'square', label: 'Квадрат' },
]

interface Props {
  design: PipeDesign
  units: Units
  onChange: (patch: Partial<PipeDesign>) => void
}

export function BowlShapeFields({ design, units, onChange }: Props) {
  function chooseProfile(id: BowlProfile) {
    const flatHeel = id === 'cylinder' ? design.flatHeel : false
    onChange({
      bowlProfile: id,
      flatHeel,
      chamberTaper: id === 'cone',
      ...derivedKnobs({
        bowlProfile: id,
        bowlHeight: design.bowlHeight,
        bowlDiameter: design.bowlDiameter,
        flatHeel,
        rings: 0,
        shankSection: design.shankSection,
      }),
    })
  }

  return (
    <>
      <p className="field-label">Форма чаши</p>
      <div className="chips">
        {PROFILES.map((profile) => (
          <button key={profile.id} type="button" className={design.bowlProfile === profile.id ? 'on' : ''} onClick={() => chooseProfile(profile.id)}>
            {profile.label}
          </button>
        ))}
      </div>
      <p className="soft">Форма подставляет канонические пятку, кромку и широкое место. Числа ниже можно изменить отдельно: готовые типы собраны из них же.</p>
      <p className="field-label">Кольца</p>
      <div className="chips">
        {(
          [
            [0, 'Нет'],
            [1, 'Одно'],
            [2, 'Два'],
          ] as const
        ).map(([count, label]) => (
          <button key={count} type="button" className={design.rings === count ? 'on' : ''} onClick={() => onChange({ rings: count })}>
            {label}
          </button>
        ))}
      </div>
      <p className="soft">Два кольца, широкое место на 0,7 высоты, низ стенки 0,42 и кромка 0,8 — это чаша бульдога. Ромб шинки делает низ острым.</p>
      <div className="field-grid">
        <Num label="Скругление пятки" mm={design.heelMm} min={0} max={40} units={units} onChange={(heelMm) => onChange({ heelMm })} hint="0 — плоский срез, как у покера" />
        <Num
          label="Плавность пятки"
          mm={design.heelLeave}
          min={0.2}
          max={0.9}
          units="mm"
          bare
          step={0.02}
          digits={2}
          onChange={(heelLeave) => onChange({ heelLeave })}
          hint="меньше — резче, как у дублина; больше — шар"
        />
        <Num
          label="Широкое место"
          mm={design.peakAt}
          min={0.2}
          max={1}
          units="mm"
          bare
          step={0.02}
          digits={2}
          onChange={(peakAt) => onChange({ peakAt })}
          hint="доля высоты. 1 — шире всего у кромки"
        />
        <Num
          label="Кромка"
          mm={design.rimFactor}
          min={0.7}
          max={1}
          units="mm"
          bare
          step={0.02}
          digits={2}
          onChange={(rimFactor) => onChange({ rimFactor })}
          hint="доля самого широкого диаметра"
        />
        <Num
          label="Низ стенки"
          mm={design.footFactor}
          min={0.35}
          max={1}
          units="mm"
          bare
          step={0.02}
          digits={2}
          onChange={(footFactor) => onChange({ footFactor })}
          hint="доля диаметра над пяткой. У конуса около 0,64"
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={design.flatHeel} onChange={(e) => onChange({ flatHeel: e.target.checked, heelMm: e.target.checked ? 0 : design.heelMm })} />
        Плоская пятка
      </label>
      <label className="check">
        <input type="checkbox" checked={design.chamberTaper} onChange={(e) => onChange({ chamberTaper: e.target.checked })} />
        Камера сужается к дну
      </label>
    </>
  )
}

export function ShankShapeFields({ design, onChange }: Props) {
  return (
    <>
      <p className="field-label">Сечение</p>
      <div className="chips">
        {SECTIONS.map((section) => (
          <button key={section.id} type="button" className={design.shankSection === section.id ? 'on' : ''} onClick={() => onChange({ shankSection: section.id })}>
            {section.label}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <Num
          label="Толще у чаши"
          mm={design.shankTaper}
          min={0}
          max={0.28}
          units="mm"
          bare
          step={0.01}
          digits={2}
          onChange={(shankTaper) => onChange({ shankTaper })}
          hint="0 — ровный чубук. 0,14 — на 14% толще у чаши, торец прежний"
        />
        {design.shankSection === 'oval' && (
          <Num
            label="Высота овала"
            mm={design.ovalRatio}
            min={0.5}
            max={1}
            units="mm"
            bare
            step={0.02}
            digits={2}
            onChange={(ovalRatio) => onChange({ ovalRatio })}
            hint="доля ширины. 0,62 — канадский овал, 1 — почти круг"
          />
        )}
      </div>
    </>
  )
}
