/** Outils communs pour lire et enregistrer des images, utilisables par tous les utilitaires. */

export interface ImageInfo {
  width: number
  height: number
  hasAlpha: boolean
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Décode un fichier image. Lève une erreur si le navigateur ne sait pas le lire. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob)
}

/** Vrai si l'image contient des pixels transparents (échantillonnage réduit). */
export function detectAlpha(img: CanvasImageSource & { width: number; height: number }): boolean {
  const c = createCanvas(Math.min(img.width, 400), Math.min(img.height, 400))
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(img, 0, 0, c.width, c.height)
  const d = x.getImageData(0, 0, c.width, c.height).data
  for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) return true
  return false
}

export async function analyzeImage(blob: Blob): Promise<ImageInfo> {
  const bmp = await decodeImage(blob)
  try {
    return { width: bmp.width, height: bmp.height, hasAlpha: detectAlpha(bmp) }
  } finally {
    bmp.close()
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion impossible'))), type)
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** « photo.final.png » → « photo.final » */
export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '') || 'image'
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

export function formatType(type: string) {
  return (type.split('/')[1] || 'image').toUpperCase().replace('JPEG', 'JPG')
}
