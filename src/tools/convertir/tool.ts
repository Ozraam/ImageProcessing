import { FileImage } from 'lucide-vue-next'
import { defineTool } from '../types'

export default defineTool({
  id: 'convertir',
  name: 'Convertir & compresser',
  description: "Exporte en PNG, JPEG, WebP ou AVIF, règle la qualité en voyant le poids et compare avant/après.",
  icon: FileImage,
  accent: { light: '#86368f', dark: '#d89ae2' },
  order: 3,
  component: () => import('./Convertir.vue'),
  card: () => import('./ConvertirCard.vue'),
})
