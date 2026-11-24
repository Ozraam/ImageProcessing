import { useSessionStorage } from '@vueuse/core'

/**
 * Réglages d'un outil, retrouvés quand on revient sur sa page (et après un F5).
 * Les nouvelles clés de `defaults` sont ajoutées aux réglages déjà enregistrés.
 */
export function useToolSettings<T extends Record<string, unknown>>(toolId: string, defaults: T) {
  return useSessionStorage<T>(`atelier:settings:${toolId}`, { ...defaults }, { mergeDefaults: true })
}
