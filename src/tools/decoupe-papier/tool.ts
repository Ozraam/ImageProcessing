import { Scissors } from 'lucide-vue-next'
import { defineTool } from '../types'

export default defineTool({
  id: 'decoupe-papier',
  name: 'Découpe papier',
  description: 'Pose un PNG détouré sur du papier froissé découpé aux ciseaux, avec son ombre.',
  icon: Scissors,
  accent: { light: '#1d6b4d', dark: '#4fbf8f' },
  order: 10,
  component: () => import('./DecoupePapier.vue'),
  card: () => import('./DecoupeCard.vue'),
})
