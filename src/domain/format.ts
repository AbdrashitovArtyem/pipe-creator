import type { Units } from './types'

const FRACTIONS: [number, string][] = [
  [3.18, '1/8″'],
  [3.57, '9/64″'],
  [3.97, '5/32″'],
  [4.37, '11/64″'],
  [6.35, '1/4″'],
  [7.94, '5/16″'],
  [9.53, '3/8″'],
  [12.7, '1/2″'],
  [19.05, '3/4″'],
  [22.23, '7/8″'],
  [25.4, '1″'],
]

export function nearestFraction(mm: number): string | null {
  let best: [number, string] | null = null
  for (const item of FRACTIONS) {
    const gap = Math.abs(item[0] - mm)
    if (gap < 0.25 && (!best || gap < Math.abs(best[0] - mm))) best = item
  }
  return best ? best[1] : null
}

export function formatLen(mm: number, units: Units, digits = 1): string {
  if (units === 'in') {
    const inches = mm / 25.4
    const frac = nearestFraction(mm)
    const body = `${inches.toFixed(3)}″`
    return frac ? `${body} (${frac})` : body
  }
  const v = Math.round(mm * 10 ** digits) / 10 ** digits
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: digits })} мм`
}

export function formatDeg(deg: number): string {
  return `${Math.round(deg * 10) / 10}°`
}

export function fromUnits(value: number, units: Units): number {
  return units === 'in' ? value * 25.4 : value
}

export function toUnits(mm: number, units: Units): number {
  return units === 'in' ? mm / 25.4 : mm
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
