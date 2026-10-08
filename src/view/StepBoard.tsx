import type { ProcessStep, StepFigure } from '../domain/process'

interface Props {
  steps: ProcessStep[]
  done: string[]
  onToggle: (key: string) => void
}

export function StepBoard({ steps, done, onToggle }: Props) {
  const total = steps.reduce((sum, step) => sum + step.checks.length, 0)
  const ready = steps.reduce((sum, step) => sum + step.checks.filter((_, index) => done.includes(keyOf(step.id, index))).length, 0)
  return (
    <div className="board">
      <div className="board-bar">
        <span>
          Чеклист {ready} из {total}
        </span>
        <i style={{ width: `${total ? (ready / total) * 100 : 0}%` }} />
      </div>
      <ol className="board-list">
        {steps.map((step, order) => {
          const stepDone = step.checks.filter((_, index) => done.includes(keyOf(step.id, index))).length
          return (
            <li key={step.id} className={stepDone === step.checks.length ? 'board-step done' : 'board-step'}>
              <div className="board-fig" aria-hidden="true">
                <Figure kind={step.figure} />
                <b>{order + 1}</b>
              </div>
              <div>
                <h3>{step.title}</h3>
                <div className="board-tools">
                  {step.uses.map((tool) => (
                    <span key={tool.label} className={tool.have ? 'have' : 'miss'}>
                      {tool.have ? tool.label : `нет: ${tool.label}`}
                    </span>
                  ))}
                </div>
                <ul className="board-lines">
                  {step.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {step.safety && <p className="safety">{step.safety}</p>}
                <ul className="board-checks">
                  {step.checks.map((label, index) => {
                    const key = keyOf(step.id, index)
                    const on = done.includes(key)
                    return (
                      <li key={key}>
                        <label>
                          <input type="checkbox" checked={on} onChange={() => onToggle(key)} />
                          {label}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function keyOf(stepId: string, index: number) {
  return `${stepId}:${index}`
}

function Figure({ kind }: { kind: StepFigure }) {
  return (
    <svg viewBox="0 0 72 48" className="fig">
      <path d="M14 10 h16 l6 8 v16 h-22 z" className="fig-wood" />
      <path d="M36 22 h22 l8 4 v6 h-30 z" className="fig-wood" />
      <path d="M58 26 h12 l-2 6 h-10 z" className="fig-stem" />
      {kind === 'stock' && <rect x="8" y="30" width="28" height="10" className="fig-mark" />}
      {kind === 'mark' && <path d="M22 8 v28 M18 30 h28" className="fig-mark" />}
      {kind === 'drill' && <path d="M64 29 h-26" className="fig-hot" />}
      {kind === 'chamber' && <path d="M24 12 v16" className="fig-hot" />}
      {kind === 'shape' && <path d="M14 14 q10 8 8 20" className="fig-mark" />}
      {kind === 'tenon' && <path d="M52 27 h8 v4 h-8 z" className="fig-hot" />}
      {kind === 'stem' && <path d="M58 24 q8 2 12 6" className="fig-hot" />}
      {kind === 'sand' && <path d="M16 16 h14 M16 22 h12 M18 28 h10" className="fig-mark" />}
      {kind === 'finish' && <circle cx="24" cy="22" r="5" className="fig-mark" />}
      {kind === 'prove' && <path d="M20 34 l4 -8 4 8" className="fig-hot" />}
      {kind === 'kit' && <path d="M22 14 v14 M22 28 h16" className="fig-hot" />}
    </svg>
  )
}
