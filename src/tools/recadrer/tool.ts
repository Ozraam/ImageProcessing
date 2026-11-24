import { Crop } from 'lucide-vue-next'
import { defineTool } from '../types'

export default defineTool({
  id: 'recadrer',
  name: 'Recadrer & pivoter',
  description: "Recadre aux bonnes proportions, redresse l'horizon, tourne par quarts de tour ou retourne en miroir.",
  icon: Crop,
  accent: { light: '#3a4fb8', dark: '#93a2f2' },
  order: 1,
  component: () => import('./Recadrer.vue'),
  card: () => import('./RecadrerCard.vue'),
})
