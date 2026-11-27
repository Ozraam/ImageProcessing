/**
 * Redimensionnement, sans DOM d'interface : utilisable dans le worker
 * (OffscreenCanvas) comme sur la page.
 */
import { context2d, encodeCanvas, newCanvas, type AnyCanvas, type Drawable } from '@/lib/canvas'

/** « lisse » : interpolation de qualité ; « net » : plus proche voisin (pixel art) */
export type Method = 'lisse' | 'net'

/** Plus grand côté accepté : au-delà, les navigateurs refusent souvent le canvas. */
export const MAX_SIDE = 16000
/** Surface maximale du résultat, en pixels */
export const MAX_AREA = 120_000_000

export interface ResizeRequest {
  /** Identifiant de l'image source (pour ne la décoder qu'une fois) */
  srcId: string
  blob: Blob
  width: number
  height: number
  method: Method
  /** Type MIME du résultat */
  type: string
  quality?: number
}

/**
 * Change la taille de `src`. En mode lisse, une forte réduction se fait par
 * paliers (jamais plus de la moitié à la fois) : une seule passe sauterait des
 * pixels et donnerait un résultat crénelé.
 */
export function resize(src: Drawable, w: number, h: number, method: Method): AnyCanvas {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h))
  if (method === 'net') {
    const out = newCanvas(W, H)
    const x = context2d(out)
    x.imageSmoothingEnabled = false
    x.drawImage(src, 0, 0, W, H)
    return out
  }
  let cur: Drawable = src
  let cw = src.width, ch = src.height
  for (;;) {
    const nw = cw >= W * 2 ? Math.ceil(cw / 2) : cw
    const nh = ch >= H * 2 ? Math.ceil(ch / 2) : ch
    if (nw === cw && nh === ch) break
    const step = newCanvas(nw, nh)
    const x = context2d(step)
    x.imageSmoothingEnabled = true
    x.imageSmoothingQuality = 'high'
    x.drawImage(cur, 0, 0, nw, nh)
    cur = step
    cw = nw
    ch = nh
  }
  const out = newCanvas(W, H)
  const x = context2d(out)
  x.imageSmoothingEnabled = true
  x.imageSmoothingQuality = 'high'
  x.drawImage(cur, 0, 0, W, H)
  return out
}

/** Calcul complet : décodage (mis en cache), redimensionnement, encodage. */
export async function processResize(req: ResizeRequest, decode: (id: string, blob: Blob) => Promise<ImageBitmap>) {
  if (req.width > MAX_SIDE || req.height > MAX_SIDE || req.width * req.height > MAX_AREA) {
    throw new Error('Dimensions trop grandes')
  }
  const src = await decode(req.srcId, req.blob)
  return encodeCanvas(resize(src, req.width, req.height, req.method), req.type, req.quality)
}

/* ---------- préréglages ---------- */

export interface Preset {
  id: string
  label: string
  detail: string
  /** Cadre dans lequel l'image doit tenir (tourné selon l'orientation de l'image) */
  box?: [number, number]
  /** Largeur imposée, hauteur proportionnelle */
  width?: number
}

export const PRESETS: Preset[] = [
  { id: 'avatar', label: 'Avatar', detail: '512 px', box: [512, 512] },
  { id: 'banniere', label: 'Bannière web', detail: '1920 px de large', width: 1920 },
  { id: 'fullhd', label: 'Full HD', detail: '1920 × 1080', box: [1920, 1080] },
  { id: 'a4', label: 'A4 · 300 dpi', detail: '3508 × 2480', box: [3508, 2480] },
  { id: 'a5', label: 'A5 · 300 dpi', detail: '2480 × 1748', box: [2480, 1748] },
]

/** Dimensions d'une source sw × sh après un préréglage, proportions conservées */
export function presetSize(p: Preset, sw: number, sh: number): [number, number] {
  let k: number
  if (p.width) k = p.width / sw
  else {
    const [a, b] = p.box!
    // le grand côté du cadre suit le grand côté de l'image
    const [bw, bh] = sw >= sh ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)]
    k = Math.min(bw / sw, bh / sh)
  }
  return [Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k))]
}

/* ---------- exemple ---------- */

/** Exemple : un cactus en pot en pixel art, à agrandir sans flou (ou à réduire). */
export function samplePixelArt(): HTMLCanvasElement {
  const art = [
    '.......PP.......',
    '......PYYP......',
    '.......PP.......',
    '......KGGK......',
    '.....KGLGGK.....',
    '.K...KGLGGK.....',
    'KGK..KGLGGK..K..',
    'KGK..KGLGGK.KGK.',
    'KGGKKKGLGGKKGGK.',
    '.KGGGGGLGGGGGK..',
    '..KKKKGLGGKKKK..',
    '.....KGGGGK.....',
    '...OOOOOOOOOO...',
    '...ORRRRRRRRO...',
    '....ORRRRRRO....',
    '.....OOOOOO.....',
  ]
  const colors: Record<string, string> = {
    K: '#1f3d2b', G: '#3f9a52', L: '#8fd07a', P: '#e8508a', Y: '#f6d33c', O: '#7a3b1e', R: '#c8643a',
  }
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const x = c.getContext('2d')!
  art.forEach((row, y) => [...row].forEach((ch, i) => {
    const col = colors[ch]
    if (!col) return
    x.fillStyle = col
    x.fillRect(i, y, 1, 1)
  }))
  return c
}
