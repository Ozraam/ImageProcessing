import type { Component } from 'vue'

/**
 * Déclaration d'un utilitaire. Placer un fichier `src/tools/<id>/tool.ts`
 * qui exporte `defineTool({...})` par défaut suffit à l'ajouter au site :
 * carte sur l'accueil, entrée du menu « Outils » et route `/outils/<id>`.
 */
export interface ToolDefinition {
  /** Identifiant d'URL : /outils/<id> */
  id: string
  name: string
  /** Une phrase, affichée sur la carte et sous le titre de la page */
  description: string
  /** Icône lucide-vue-next */
  icon: Component
  /**
   * Couleur propre à l'outil. Elle remplace la couleur principale (boutons,
   * curseurs, focus, icône) dans toute la page de l'outil.
   */
  accent: { light: string; dark: string }
  /** Page de l'outil, chargée à la demande. Elle utilise <ToolLayout>. */
  component: () => Promise<Component>
  /** Vignette de la carte d'accueil (facultative ; par défaut l'icône sur l'accent). */
  card?: () => Promise<Component>
  /** Badge sur la carte et le titre */
  status?: 'stable' | 'beta'
  /** Ordre d'affichage (croissant) */
  order?: number
}

export const defineTool = (tool: ToolDefinition) => tool
