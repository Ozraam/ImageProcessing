import { Scaling } from 'lucide-vue-next'
import { defineTool } from '../types'

export default defineTool({
  id: 'redimensionner',
  name: 'Redimensionner',
  description: 'Change la taille en pixels ou en pourcentage, avec des préréglages et un mode net pour le pixel art.',
  icon: Scaling,
  accent: { light: '#b0501c', dark: '#f0a36a' },
  order: 2,
  component: () => import('./Redimensionner.vue'),
  card: () => import('./RedimensionnerCard.vue'),
})
