/**
 * Canvas utilisables aussi bien sur la page (HTMLCanvasElement) que dans un
 * Web Worker (OffscreenCanvas) : un même `render.ts` sert aux deux.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
export type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type Drawable = CanvasImageSource & { width: number; height: number }

/** Canvas de la page s'il y a un document, OffscreenCanvas dans un worker */
export function newCanvas(w: number, h: number): AnyCanvas {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h))
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return c
  }
  return new OffscreenCanvas(W, H)
}

export const context2d = (c: AnyCanvas) => c.getContext('2d') as AnyContext

/** Encode un canvas. `quality` (0–1) ne sert qu'aux formats avec perte. */
export function encodeCanvas(c: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    c.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion impossible'))), type, quality)
  })
}

/**
 * Garde en mémoire la dernière image décodée : les réglages changent souvent,
 * l'image source rarement.
 */
export function lastBitmap() {
  let key = ''
  let bmp: Promise<ImageBitmap> | null = null
  return (id: string, blob: Blob): Promise<ImageBitmap> => {
    if (id !== key || !bmp) {
      bmp?.then(b => b.close()).catch(() => {})
      key = id
      bmp = createImageBitmap(blob).catch(err => {
        key = ''
        throw err
      })
    }
    return bmp
  }
}
