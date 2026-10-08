import { useState } from 'react'
import type { Units } from '../domain/types'
import { formatLen, fromUnits, toUnits } from '../domain/format'

export function Num({
  label,
  mm,
  min,
  max,
  units,
  onChange,
  bare,
  suffix,
  hint,
  step: stepProp,
  digits: digitsProp,
}: {
  label: string
  mm: number | null
  min: number
  max: number
  units: Units
  onChange: (mm: number) => void
  bare?: boolean
  suffix?: string
  hint?: string
  step?: number
  digits?: number
}) {
  const digits = digitsProp ?? (bare ? 1 : units === 'in' ? 3 : 1)
  const empty = mm == null
  const committed = empty ? '' : String(roundInput(bare ? mm : toUnits(mm, units), digits))
  const [draft, setDraft] = useState<string | null>(null)
  const minShown = bare ? min : toUnits(min, units)
  const maxShown = bare ? max : toUnits(max, units)
  const step = stepProp ?? (bare ? 0.5 : units === 'in' ? 0.005 : 0.1)

  function push(raw: string, clampValue: boolean) {
    const trimmed = raw.trim().replace(',', '.')
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return
    const inside = n >= minShown - 1e-9 && n <= maxShown + 1e-9
    if (!inside && !clampValue) return
    const shown = clampValue ? Math.min(maxShown, Math.max(minShown, n)) : n
    onChange(bare ? shown : fromUnits(shown, units))
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-box">
        <input
          type="number"
          min={minShown}
          max={maxShown}
          step={step}
          placeholder="—"
          value={draft ?? committed}
          onChange={(e) => {
            const raw = e.target.value
            setDraft(raw)
            push(raw, false)
          }}
          onBlur={() => {
            if (draft != null) push(draft, true)
            setDraft(null)
          }}
        />
        <em>{suffix ?? (bare ? '' : units === 'in' ? '″' : 'мм')}</em>
      </span>
      {hint ? <small>{hint}</small> : !bare && !empty ? <small>{formatLen(mm, units === 'mm' ? 'in' : 'mm', 1)}</small> : null}
    </label>
  )
}

function roundInput(n: number, digits: number) {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-box">
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}
