import type { PipeDesign, Units } from './types'
import type { ToolInventory } from './tools'
import { defaultTools } from './tools'
import { blankDesign, designFromShape, fillBlank } from './shapes'
import { uid } from './format'

export interface Project {
  id: string
  name: string
  design: PipeDesign
  updatedAt: number
}

interface Persisted {
  projects: Project[]
  activeId: string
  tools: ToolInventory
  units: Units
  progress: Record<string, string[]>
}

const KEY = 'pipe-workshop-v1'

function fresh(): Persisted {
  const design = designFromShape('billiard')
  return {
    projects: [{ id: design.id, name: design.name, design, updatedAt: Date.now() }],
    activeId: design.id,
    tools: defaultTools(),
    units: 'mm',
    progress: {},
  }
}

export function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const parsed = JSON.parse(raw) as Persisted
    if (!parsed.projects?.length || !parsed.tools) return fresh()
    parsed.projects = parsed.projects.map((project) => ({
      ...project,
      design: fillBlank(project.design),
    }))
    parsed.progress = parsed.progress ?? {}
    return parsed
  } catch {
    return fresh()
  }
}

export function saveState(state: Persisted): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function touchProject(project: Project, design: PipeDesign): Project {
  return { ...project, name: design.name, design, updatedAt: Date.now() }
}

export function newProject(shapeId = 'billiard'): Project {
  const design = shapeId === 'custom' ? blankDesign({ id: uid() }) : designFromShape(shapeId, { id: uid() })
  return { id: design.id, name: design.name, design, updatedAt: Date.now() }
}

export type { Persisted }
