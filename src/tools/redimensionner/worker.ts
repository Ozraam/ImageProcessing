/** Web Worker de Redimensionner : les fortes réductions de très grandes images ne figent pas la page. */
import { lastBitmap } from '@/lib/canvas'
import { serveTasks } from '@/lib/task-worker'
import { processResize, type ResizeRequest } from './render'

const decode = lastBitmap()

serveTasks<ResizeRequest, Blob>(async req => ({ res: await processResize(req, decode) }))
