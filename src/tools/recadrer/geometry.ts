/**
 * Géométrie du recadrage, sans DOM.
 *
 * Transformation appliquée à l'image source, dans cet ordre :
 *   1. `D` : rotation par quarts de tour et miroirs (matrice 2×2 à coefficients -1, 0, 1) ;
 *   2. rotation fine d'angle `angle` (degrés, sens horaire) autour du centre.
 *
 * Le « cadre de travail » a les dimensions de l'image après `D` (W' × H').
 * Le recadrage y est exprimé en coordonnées normalisées (0–1) et doit rester
 * entièrement à l'intérieur de l'image tournée : pas de coins vides à l'export.
 */

/** Matrice [a, b, c, d] : x' = a·x + b·y ; y' = c·x + d·y (axe y vers le bas) */
export type Mat = [number, number, number, number]

export interface Crop { x: number; y: number; w: number; h: number }

export interface Transform {
  mat: Mat
  /** Rotation fine en degrés, de -45 à 45 */
  angle: number
}

export const IDENTITY: Mat = [1, 0, 0, 1]
export const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }

const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
]

/** Vrai si la transformation échange largeur et hauteur */
export const swapsAxes = (m: Mat) => m[0] === 0

/** Dimensions du cadre de travail pour une source w × h */
export function frameSize(m: Mat, w: number, h: number): [number, number] {
  return swapsAxes(m) ? [h, w] : [w, h]
}

/* ---------- opérations de l'utilisateur (relatives à l'écran) ---------- */

/** Quart de tour horaire (dir = 1) ou antihoraire (dir = -1) : le cadre tourne avec l'image. */
export function rotateQuarter(t: Transform, crop: Crop, dir: 1 | -1): [Transform, Crop] {
  const r: Mat = dir === 1 ? [0, -1, 1, 0] : [0, 1, -1, 0]
  const c = dir === 1
    ? { x: 1 - crop.y - crop.h, y: crop.x, w: crop.h, h: crop.w }
    : { x: crop.y, y: 1 - crop.x - crop.w, w: crop.h, h: crop.w }
  // une rotation autour du centre commute avec la rotation fine
  return [{ mat: mul(r, t.mat), angle: t.angle }, c]
}

/** Miroir horizontal ou vertical de l'image affichée : l'inclinaison s'inverse elle aussi. */
export function flip(t: Transform, crop: Crop, axis: 'h' | 'v'): [Transform, Crop] {
  const f: Mat = axis === 'h' ? [-1, 0, 0, 1] : [1, 0, 0, -1]
  const c = axis === 'h' ? { ...crop, x: 1 - crop.x - crop.w } : { ...crop, y: 1 - crop.y - crop.h }
  return [{ mat: mul(f, t.mat), angle: t.angle ? -t.angle : 0 }, c]
}

/* ---------- contraintes ---------- */

/** Le rectangle (en pixels du cadre W × H) est-il dans le cadre et dans l'image tournée ? */
export function isValid(c: Crop, W: number, H: number, angle: number): boolean {
  const eps = 1e-6 * Math.max(W, H)
  if (c.w <= 0 || c.h <= 0) return false
  if (c.x < -eps || c.y < -eps || c.x + c.w > W + eps || c.y + c.h > H + eps) return false
  if (!angle) return true
  const t = angle * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t)
  const cx = W / 2, cy = H / 2
  for (const [px, py] of [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]] as const) {
    const qx = px - cx, qy = py - cy
    // coordonnées dans le repère de l'image (rotation inverse)
    const u = qx * cos + qy * sin, v = -qx * sin + qy * cos
    if (Math.abs(u) > W / 2 + eps || Math.abs(v) > H / 2 + eps) return false
  }
  return true
}

/** Plus grand rectangle de proportions r (largeur / hauteur, en pixels) centré dans l'image tournée. */
export function maxCentered(r: number, W: number, H: number, angle: number): Crop {
  const t = Math.abs(angle) * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t)
  // demi-largeur a, demi-hauteur a / r
  const a = Math.min(W / 2, H / 2 * r, (W / 2) / (cos + sin / r), (H / 2) / (sin + cos / r)) * (1 - 1e-9)
  const w = 2 * a, h = 2 * a / r
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
}

const lerp = (a: Crop, b: Crop, t: number): Crop => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t,
})

/**
 * Va de `from` (valide) vers `to` aussi loin que possible en restant valide.
 * L'ensemble des rectangles valides est convexe, donc une dichotomie suffit.
 */
export function towards(from: Crop, to: Crop, W: number, H: number, angle: number): Crop {
  if (isValid(to, W, H, angle)) return to
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (isValid(lerp(from, to, m), W, H, angle)) lo = m; else hi = m
  }
  return lerp(from, to, lo)
}

/** Ramène un cadre invalide (après un changement d'angle) dans l'image, en gardant ses proportions. */
export function fitInside(c: Crop, W: number, H: number, angle: number): Crop {
  if (isValid(c, W, H, angle)) return c
  const best = maxCentered(c.w / c.h, W, H, angle)
  // d'abord rétrécir autour de son propre centre…
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2
  const dot = { x: cx, y: cy, w: 1e-9, h: 1e-9 / (c.w / c.h) }
  if (isValid(dot, W, H, angle)) {
    const s = towards(dot, c, W, H, angle)
    if (s.w >= best.w * 0.5) return s
  }
  // …sinon glisser vers le plus grand cadre centré
  return towards(best, c, W, H, angle)
}

/* ---------- conversions ---------- */

export const toPx = (c: Crop, W: number, H: number): Crop => ({ x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H })
export const toNorm = (c: Crop, W: number, H: number): Crop => ({ x: c.x / W, y: c.y / H, w: c.w / W, h: c.h / H })

/** Dimensions entières du résultat pour une source w × h */
export function outputSize(t: Transform, crop: Crop, w: number, h: number): [number, number] {
  const [W, H] = frameSize(t.mat, w, h)
  return [Math.max(1, Math.round(crop.w * W)), Math.max(1, Math.round(crop.h * H))]
}
