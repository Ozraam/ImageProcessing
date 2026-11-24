/**
 * Web Worker du rendu Découpe papier : le calcul (plusieurs centaines de ms,
 * plusieurs secondes à l'export) ne fige plus la page.
 *
 * Les messages sont traités un par un, dans l'ordre. Pour l'aperçu, seule la
 * dernière demande compte : les demandes dépassées sont ignorées.
 */
import { applyCrop, render, type Crop, type DecoupeParams } from './render'
import type { WorkerRequest, WorkerResponse } from './protocol'

// Portée du worker (types DOM du projet : on ne décrit que ce qui sert)
const scope = self as unknown as {
  postMessage(message: WorkerResponse, transfer: Transferable[]): void
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
}

let src: ImageBitmap | null = null
let bg: ImageBitmap | null = null
let latestPreview = 0
let queue: Promise<void> = Promise.resolve()

const reply = (msg: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(msg, transfer)

async function decode(blob: Blob | null, old: ImageBitmap | null) {
  old?.close()
  return blob ? createImageBitmap(blob) : null
}

function doRender(params: DecoupeParams, size: number, crop: Crop | null) {
  if (!src) throw new Error('Aucune image source')
  return applyCrop(render(src, params, size, bg), crop) as OffscreenCanvas
}

async function handle(msg: WorkerRequest) {
  switch (msg.type) {
    case 'source':
      src = await decode(msg.blob, src)
      return
    case 'background':
      bg = await decode(msg.blob, bg)
      return
    case 'preview': {
      if (msg.id < latestPreview) return reply({ id: msg.id, type: 'skipped' })
      const t0 = performance.now()
      const canvas = doRender(msg.params, msg.size, null)
      const image = canvas.transferToImageBitmap()
      return reply({ id: msg.id, type: 'preview', image, ms: performance.now() - t0 }, [image])
    }
    case 'export': {
      const canvas = doRender(msg.params, msg.size, msg.crop)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      return reply({ id: msg.id, type: 'export', blob })
    }
  }
}

scope.onmessage = e => {
  const msg = e.data
  if (msg.type === 'preview') latestPreview = Math.max(latestPreview, msg.id)
  queue = queue
    .then(() => handle(msg))
    .catch(err => {
      if ('id' in msg) reply({ id: msg.id, type: 'error', message: String(err?.message ?? err) })
    })
}
