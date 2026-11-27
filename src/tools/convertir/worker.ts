/** Web Worker de Convertir : l'encodage d'une grande image ne fige pas la page. */
import { lastBitmap } from '@/lib/canvas'
import { serveTasks } from '@/lib/task-worker'
import { processConvert, type ConvertRequest } from './render'

const decode = lastBitmap()

serveTasks<ConvertRequest, Blob>(async req => ({ res: await processConvert(req, decode) }))
