import type { ToolDefinition } from './types'

// Découverte automatique : chaque dossier de src/tools/ qui contient un tool.ts.
const modules = import.meta.glob<{ default: ToolDefinition }>('./*/tool.ts', { eager: true })

export const tools: ToolDefinition[] = Object.values(modules)
  .map(m => m.default)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name, 'fr'))

export const toolById = (id: string) => tools.find(t => t.id === id)

export const toolPath = (tool: ToolDefinition) => `/outils/${tool.id}`
