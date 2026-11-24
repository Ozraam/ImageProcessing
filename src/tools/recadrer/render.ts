import { frameSize, type Crop, type Transform } from './geometry'

type Source = CanvasImageSource & { width: number; height: number }

/**
 * Dessine la source transformée (quarts de tour, miroirs, rotation fine).
 * Sans `crop`, tout le cadre de travail est dessiné (aperçu) ; avec, seulement la zone gardée (export).
 * `scale` réduit le résultat (1 = pleine résolution de `src`).
 */
export function renderTransformed(src: Source, t: Transform, crop: Crop | null, scale = 1): HTMLCanvasElement {
  const sw = src.width, sh = src.height
  const [W, H] = frameSize(t.mat, sw, sh)
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(c.w * W * scale))
  out.height = Math.max(1, Math.round(c.h * H * scale))
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.scale(out.width / (c.w * W), out.height / (c.h * H))
  ctx.translate(-c.x * W + W / 2, -c.y * H + H / 2)
  ctx.rotate(t.angle * Math.PI / 180)
  const [a, b, cc, d] = t.mat
  ctx.transform(a, cc, b, d, 0, 0)
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh)
  return out
}

/** Exemple : un paysage marin dont l'horizon penche, à redresser. */
export function sampleLandscape(): HTMLCanvasElement {
  const W = 1600, H = 1067
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.translate(W / 2, H / 2)
  x.rotate(-4 * Math.PI / 180)
  x.translate(-W / 2, -H / 2)
  const pad = 200
  const sky = x.createLinearGradient(0, -pad, 0, H * 0.58)
  sky.addColorStop(0, '#f3a76b'); sky.addColorStop(0.55, '#f7cf94'); sky.addColorStop(1, '#fbe7c4')
  x.fillStyle = sky; x.fillRect(-pad, -pad, W + 2 * pad, H * 0.58 + pad)
  x.fillStyle = '#fff4d6'
  x.beginPath(); x.arc(W * 0.66, H * 0.5, 74, 0, Math.PI * 2); x.fill()
  const sea = x.createLinearGradient(0, H * 0.58, 0, H + pad)
  sea.addColorStop(0, '#3c6e8f'); sea.addColorStop(1, '#173449')
  x.fillStyle = sea; x.fillRect(-pad, H * 0.58, W + 2 * pad, H * 0.42 + pad)
  x.fillStyle = 'rgba(255,240,200,.55)'
  for (let i = 0; i < 14; i++) {
    const y = H * 0.6 + i * i * 2.6, w = 160 - i * 8
    x.fillRect(W * 0.66 - w / 2 + Math.sin(i * 2.3) * 20, y, w, 3 + i * 0.4)
  }
  // un voilier, pour avoir un sujet à cadrer
  x.fillStyle = '#2a2a33'
  x.beginPath(); x.moveTo(W * 0.27, H * 0.6); x.lineTo(W * 0.36, H * 0.6); x.lineTo(W * 0.345, H * 0.625); x.lineTo(W * 0.285, H * 0.625); x.fill()
  x.fillStyle = '#fdf8ee'
  x.beginPath(); x.moveTo(W * 0.315, H * 0.36); x.lineTo(W * 0.315, H * 0.59); x.lineTo(W * 0.355, H * 0.59); x.fill()
  x.beginPath(); x.moveTo(W * 0.31, H * 0.4); x.lineTo(W * 0.31, H * 0.59); x.lineTo(W * 0.278, H * 0.59); x.fill()
  return c
}
