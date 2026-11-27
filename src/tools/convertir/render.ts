/**
 * Conversion et compression, sans DOM d'interface : utilisable dans le worker
 * (OffscreenCanvas) comme sur la page.
 *
 * L'image est redessinée depuis ses pixels puis réencodée : les métadonnées
 * (EXIF, position GPS, appareil…) ne passent pas dans le résultat.
 */
import { context2d, encodeCanvas, newCanvas } from '@/lib/canvas'

export interface FormatInfo {
  type: string
  label: string
  ext: string
  /** Format avec perte : le curseur de qualité s'applique */
  lossy: boolean
  /** Le format garde la transparence */
  alpha: boolean
}

export const FORMATS: FormatInfo[] = [
  { type: 'image/png', label: 'PNG', ext: 'png', lossy: false, alpha: true },
  { type: 'image/jpeg', label: 'JPEG', ext: 'jpg', lossy: true, alpha: false },
  { type: 'image/webp', label: 'WebP', ext: 'webp', lossy: true, alpha: true },
  { type: 'image/avif', label: 'AVIF', ext: 'avif', lossy: true, alpha: true },
]

export const formatInfo = (type: string) => FORMATS.find(f => f.type === type) ?? FORMATS[0]!

export interface ConvertRequest {
  srcId: string
  blob: Blob
  type: string
  /** 0–1, ignoré pour PNG */
  quality: number
  /** Couleur de fond qui remplace la transparence (null : garder la transparence) */
  background: string | null
}

export async function processConvert(req: ConvertRequest, decode: (id: string, blob: Blob) => Promise<ImageBitmap>) {
  const src = await decode(req.srcId, req.blob)
  const c = newCanvas(src.width, src.height)
  const x = context2d(c)
  if (req.background) {
    x.fillStyle = req.background
    x.fillRect(0, 0, c.width, c.height)
  }
  x.drawImage(src, 0, 0)
  const lossy = formatInfo(req.type).lossy
  const blob = await encodeCanvas(c, req.type, lossy ? req.quality : undefined)
  // un navigateur qui ne sait pas encoder ce format renvoie du PNG sans prévenir
  if (blob.type !== req.type) throw new Error(`Format ${req.type} non pris en charge`)
  return blob
}

/** Formats que ce navigateur sait encoder (PNG et JPEG le sont toujours). */
export async function encodableTypes(): Promise<string[]> {
  const c = document.createElement('canvas')
  c.width = c.height = 2
  const ok = await Promise.all(FORMATS.map(f => new Promise<boolean>(resolve => {
    try {
      c.toBlob(b => resolve(b?.type === f.type), f.type, 0.5)
    } catch {
      resolve(false)
    }
  })))
  return FORMATS.filter((f, i) => ok[i] || f.type === 'image/png' || f.type === 'image/jpeg').map(f => f.type)
}

/**
 * Cherche des métadonnées dans le début du fichier : bloc EXIF (JPEG, WebP, PNG eXIf)
 * ou XMP. Simple repérage d'octets, pour prévenir l'utilisateur.
 */
export async function findMetadata(blob: Blob): Promise<{ exif: boolean; gps: boolean; xmp: boolean }> {
  const bytes = new Uint8Array(await blob.slice(0, 512 * 1024).arrayBuffer())
  const text = new TextDecoder('latin1').decode(bytes)
  const exif = /Exif\0\0|eXIf|EXIF/.test(text)
  const xmp = text.includes('<x:xmpmeta') || text.includes('http://ns.adobe.com/xap/')
  // le pointeur GPS (balise 0x8825) dans l'IFD0, en gros ou petit boutiste
  const gps = exif && (/\x88\x25\0\x04/.test(text) || /\x25\x88\x04\0/.test(text) || text.includes('exif:GPS'))
  return { exif, gps, xmp }
}

/** Exemple : une photo nette avec des aplats, du texte et un dégradé, où les artefacts se voient. */
export function samplePhoto(): HTMLCanvasElement {
  const W = 1400, H = 933
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')!
  const sky = x.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#2a3f7a'); sky.addColorStop(0.5, '#c86b8a'); sky.addColorStop(1, '#f5b971')
  x.fillStyle = sky; x.fillRect(0, 0, W, H)
  // collines
  const hills: [string, number, number][] = [['#5a3a6e', 0.62, 70], ['#3d2852', 0.72, 50], ['#24183a', 0.84, 34]]
  for (const [col, y0, amp] of hills) {
    x.fillStyle = col
    x.beginPath(); x.moveTo(0, H)
    for (let i = 0; i <= W; i += 10) x.lineTo(i, H * y0 + Math.sin(i / 130 + y0 * 9) * amp + Math.sin(i / 47) * amp * 0.25)
    x.lineTo(W, H); x.fill()
  }
  x.fillStyle = '#fff3d9'
  x.beginPath(); x.arc(W * 0.72, H * 0.38, 62, 0, Math.PI * 2); x.fill()
  // texte fin et lignes : les compressions fortes y laissent des bavures
  x.fillStyle = '#ffffff'
  x.font = '600 64px system-ui, sans-serif'
  x.fillText('Atelier', 70, 130)
  x.font = '22px system-ui, sans-serif'
  x.fillText('Compressez, comparez, exportez.', 74, 172)
  x.strokeStyle = 'rgba(255,255,255,.75)'
  x.lineWidth = 1
  for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(74, 200 + i * 6); x.lineTo(420, 200 + i * 6); x.stroke() }
  return c
}
