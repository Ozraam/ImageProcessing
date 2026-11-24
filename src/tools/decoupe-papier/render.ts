/**
 * Rendu « découpé dans du papier froissé ».
 * Algorithme repris tel quel de l'ancienne page index.html, sans dépendance à l'interface.
 */
import { createCanvas as mk } from '@/lib/image'

export type Source = CanvasImageSource & { width: number; height: number }

export interface DecoupeParams {
  cut: 'round' | 'straight'
  cutlen: number
  border: number
  irr: number
  smooth: number
  holes: boolean
  paper: string
  crumple: number
  cscale: number
  subj: number
  shop: number
  shblur: number
  shx: number
  shy: number
  bgmode: 'wall' | 'color' | 'image' | 'none'
  bgcolor: string
  margin: number
  seed: number
}

export const defaultParams: DecoupeParams = {
  cut: 'round',
  cutlen: 60,
  border: 3.5,
  irr: 45,
  smooth: 40,
  holes: true,
  paper: '#f6f6f1',
  crumple: 55,
  cscale: 40,
  subj: 25,
  shop: 50,
  shblur: 35,
  shx: 10,
  shy: 18,
  bgmode: 'none',
  bgcolor: '#3e7d38',
  margin: 12,
  seed: 7,
}

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

/* ---------- bruit ---------- */
const GX = new Float32Array(256), GY = new Float32Array(256)
for (let i = 0; i < 256; i++) { const a = i / 256 * Math.PI * 2; GX[i] = Math.cos(a); GY[i] = Math.sin(a) }
function hash(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return h >>> 0
}
const h01 = (x: number, y: number, s: number) => hash(x, y, s) / 4294967296
function gnoise(x: number, y: number, s: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const g = (cx: number, cy: number, dx: number, dy: number) => { const k = hash(cx, cy, s) & 255; return GX[k]! * dx + GY[k]! * dy }
  const a = g(ix, iy, fx, fy), b = g(ix + 1, iy, fx - 1, fy), c = g(ix, iy + 1, fx, fy - 1), d = g(ix + 1, iy + 1, fx - 1, fy - 1)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41
}
function fbm(x: number, y: number, s: number, oct: number) {
  let t = 0, amp = 1, n = 0
  for (let o = 0; o < oct; o++) { t += gnoise(x, y, s + o * 31) * amp; n += amp; amp *= 0.5; x *= 2.03; y *= 2.03 }
  return t / n
}
// facettes de papier froissé (Voronoï : chaque cellule = un plan incliné)
function facet(x: number, y: number, s: number, out: number[]) {
  const ix = Math.floor(x), iy = Math.floor(y)
  let d1 = 1e9, d2 = 1e9, bx = 0, by = 0
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j
    const px = cx + 0.1 + 0.8 * h01(cx, cy, s), py = cy + 0.1 + 0.8 * h01(cx, cy, s + 7)
    const dx = px - x, dy = py - y, d = dx * dx + dy * dy
    if (d < d1) { d2 = d1; d1 = d; bx = cx; by = cy } else if (d < d2) d2 = d
  }
  out[0] = h01(bx, by, s + 13) * 2 - 1; out[1] = h01(bx, by, s + 19) * 2 - 1
  out[2] = Math.sqrt(d2) - Math.sqrt(d1)
}

/* ---------- distance euclidienne (Felzenszwalb) ---------- */
const INF = 1e20
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    while (s <= z[k]!) { k--; s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!) }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; const t = q - v[k]!; d[q] = t * t + f[v[k]!]! }
}
// grid : 0 sur les pixels source, INF ailleurs → distance (racine)
function edt(grid: Float32Array, W: number, H: number) {
  const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1)
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = grid[y * W + x]!; edt1d(f, H, d, v, z); for (let y = 0; y < H; y++) grid[y * W + x] = d[y]! }
  for (let y = 0; y < H; y++) { const o = y * W; for (let x = 0; x < W; x++) f[x] = grid[o + x]!; edt1d(f, W, d, v, z); for (let x = 0; x < W; x++) grid[o + x] = Math.sqrt(d[x]!) }
  return grid
}

function boxBlurAlpha(data: Uint8ClampedArray, W: number, H: number, r: number) {
  if (r < 1) return
  const a = new Float32Array(W * H), t = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) a[i] = data[i * 4 + 3]!
  const pass = (src: Float32Array, dst: Float32Array, len: number, count: number, stride: number, step: number) => {
    for (let c = 0; c < count; c++) {
      const base = c * stride; let sum = 0; const w = 2 * r + 1
      for (let k = -r; k <= r; k++) sum += src[base + Math.min(len - 1, Math.max(0, k)) * step]!
      for (let i = 0; i < len; i++) {
        dst[base + i * step] = sum / w
        sum += src[base + Math.min(len - 1, i + r + 1) * step]! - src[base + Math.max(0, i - r) * step]!
      }
    }
  }
  for (let p = 0; p < 3; p++) { pass(a, t, W, H, W, 1); pass(t, a, H, W, 1, W) }
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = a[i]!
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

/* ---------- rendu ---------- */
export function render(src: Source, p: DecoupeParams, targetL: number, bgImg: Source | null = null): HTMLCanvasElement {
  const seed = p.seed
  const sL = Math.max(src.width, src.height), s = Math.min(1, targetL / sL)
  const iw = Math.max(1, Math.round(src.width * s)), ih = Math.max(1, Math.round(src.height * s))
  const L = Math.max(iw, ih)
  const R = p.border / 100 * L, J = R * p.irr / 100 * 0.9, S = p.smooth / 100 * 0.05 * L
  const blur = p.shblur / 100 * 0.05 * L, ox = p.shx / 100 * 0.04 * L, oy = p.shy / 100 * 0.04 * L
  const pad = Math.ceil(R + J + 3 + Math.max(Math.abs(ox), Math.abs(oy)) + blur * 1.6 + p.margin / 100 * L)
  const W = iw + 2 * pad, H = ih + 2 * pad, N = W * H

  // sujet
  const sc = mk(W, H), sx = ctx2d(sc)
  sx.imageSmoothingQuality = 'high'; sx.drawImage(src, pad, pad, iw, ih)
  const sp = sx.getImageData(0, 0, W, H).data

  // masque binaire (+ trous bouchés)
  const m = new Uint8Array(N)
  for (let i = 0; i < N; i++) m[i] = sp[i * 4 + 3]! > 40 ? 1 : 0
  if (p.holes) {
    const out = new Uint8Array(N), st = new Int32Array(N); let top = 0
    const push = (i: number) => { if (!m[i] && !out[i]) { out[i] = 1; st[top++] = i } }
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
    while (top) {
      const i = st[--top]!, x = i % W
      if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W)
    }
    for (let i = 0; i < N; i++) if (!out[i]) m[i] = 1
  }

  // champ de distance signé du bord de papier
  const Rt = R + J
  const g = new Float32Array(N)
  for (let i = 0; i < N; i++) g[i] = m[i] ? 0 : INF
  edt(g, W, H)
  let e: Float32Array
  if (S >= 0.5) {
    const g2 = new Float32Array(N), lim = Rt + S
    for (let i = 0; i < N; i++) g2[i] = g[i]! <= lim ? INF : 0
    edt(g2, W, H)
    for (let i = 0; i < N; i++) g2[i] = g2[i]! - S
    e = g2
  } else { for (let i = 0; i < N; i++) g[i] = Rt - g[i]!; e = g }

  // coupe droite : contour iso → polygone simplifié → rasterisé
  let polyA: Uint8ClampedArray | null = null, rimA: Uint8ClampedArray | null = null
  if (p.cut === 'straight') {
    const tol = Math.max(1.2, (0.12 + 0.78 * p.cutlen / 100) * (R + 0.5 * J))
    const loops = isoLoops(e, W, H).map(l => simplifyClosed(l, tol)).filter(l => l.length >= 3)
    const path = new Path2D()
    for (const l of loops) {
      l.forEach(([x, y], i) => {
        const jx = J > 0 ? (h01(Math.round(x), Math.round(y), seed + 77) - 0.5) * J * 0.7 : 0
        const jy = J > 0 ? (h01(Math.round(x), Math.round(y), seed + 78) - 0.5) * J * 0.7 : 0
        if (i) path.lineTo(x + jx, y + jy); else path.moveTo(x + jx, y + jy)
      })
      path.closePath()
    }
    const fc = mk(W, H), fx = ctx2d(fc); fx.fillStyle = '#000'; fx.fill(path, 'evenodd')
    polyA = fx.getImageData(0, 0, W, H).data
    const rc = mk(W, H), rx = ctx2d(rc); rx.strokeStyle = '#000'; rx.lineJoin = 'miter'
    rx.lineWidth = Math.max(2.4, 0.005 * L); rx.stroke(path)
    rimA = rx.getImageData(0, 0, W, H).data
  }

  // texture de froissage (basse résolution puis agrandie)
  const q = Math.max(1, Math.round(L / 600))
  const tw = Math.ceil(W / q), th = Math.ceil(H / q), tc = mk(tw, th), tx = ctx2d(tc)
  const td = tx.createImageData(tw, th), tp = td.data
  const f1 = 2.5 + p.cscale * 0.13, f2 = f1 * 2.6, f3 = f1 * 7, fo = [0, 0, 0]
  const lx = -0.6, ly = -0.8, eps = 0.02
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const u = x * q / L, v = y * q / L
    facet(u * f1, v * f1, seed, fo); let nx = fo[0]!, ny = fo[1]!; const cr = fo[2]!
    facet(u * f2, v * f2, seed + 101, fo); nx += fo[0]! * 0.5; ny += fo[1]! * 0.5
    const crease = Math.min(cr, fo[2]! * 0.8)
    const gx = gnoise((u + eps) * f3, v * f3, seed + 5) - gnoise((u - eps) * f3, v * f3, seed + 5)
    const gy = gnoise(u * f3, (v + eps) * f3, seed + 5) - gnoise(u * f3, (v - eps) * f3, seed + 5)
    nx += gx * 0.9; ny += gy * 0.9
    let sh = (nx * lx + ny * ly) * 0.45
    if (crease < 0.04) sh -= (1 - crease / 0.04) * 0.35
    const val = 128 + Math.max(-1, Math.min(1, sh)) * 127, k = (y * tw + x) * 4
    tp[k] = tp[k + 1] = tp[k + 2] = val; tp[k + 3] = 255
  }
  tx.putImageData(td, 0, 0)
  const shc = mk(W, H), shx = ctx2d(shc)
  shx.imageSmoothingQuality = 'high'; shx.drawImage(tc, 0, 0, tw * q, th * q)
  const shd = shx.getImageData(0, 0, W, H).data

  // composition papier + sujet
  const cd = new ImageData(W, H), cp = cd.data
  const md = new ImageData(W, H), mp = md.data
  const fl = 13, fh = 95, cru = p.crumple / 100 * 0.32, scr = p.subj / 100 * 0.32
  const rimW = Math.max(1.2, 0.0022 * L)
  const [pr, pg, pb] = hex(p.paper)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = i * 4
    let ev = e[i]!, P: number, rim: number
    if (polyA && rimA) {
      P = polyA[k + 3]! / 255; rim = 1 - 0.16 * rimA[k + 3]! / 255
    } else {
      if (J > 0 && ev > -1 && ev < J + 1.5) {
        const u = x / L, v = y / L
        const n = 0.75 * fbm(u * fl, v * fl, seed + 900, 3) + 0.25 * gnoise(u * fh, v * fh, seed + 950)
        ev -= J * Math.max(0, Math.min(1, n * 0.6 + 0.5))
      } else if (J > 0 && ev >= J + 1.5) ev -= J * 0.5
      P = ev <= -0.5 ? 0 : ev >= 0.5 ? 1 : ev + 0.5
      rim = ev < rimW ? 1 - 0.16 * (1 - Math.max(0, ev) / rimW) : 1
    }
    const a = sp[k + 3]! / 255
    if (P === 0 && a === 0) continue
    const sh = (shd[k]! - 128) / 127
    const pf = (1 + sh * cru) * rim, sf = 1 + sh * scr
    const oa = a + P * (1 - a), wP = P * (1 - a)
    cp[k] = (sp[k]! * sf * a + pr * pf * wP) / oa
    cp[k + 1] = (sp[k + 1]! * sf * a + pg * pf * wP) / oa
    cp[k + 2] = (sp[k + 2]! * sf * a + pb * pf * wP) / oa
    cp[k + 3] = oa * 255
    mp[k + 3] = Math.max(P, a) * 255
  }
  const cc = mk(W, H); ctx2d(cc).putImageData(cd, 0, 0)

  // sortie
  const out = mk(W, H), ox2 = ctx2d(out)
  if (p.bgmode === 'color') { ox2.fillStyle = p.bgcolor; ox2.fillRect(0, 0, W, H) }
  else if (p.bgmode === 'wall') drawWall(ox2, W, H, hex(p.bgcolor), L, seed)
  else if (p.bgmode === 'image' && bgImg) {
    const r = Math.max(W / bgImg.width, H / bgImg.height), bw = bgImg.width * r, bh = bgImg.height * r
    ox2.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
  }
  if (p.shop > 0) {
    const kd = Math.max(1, blur / 6), sw = Math.ceil(W / kd), shh = Math.ceil(H / kd)
    const mc = mk(W, H); ctx2d(mc).putImageData(md, 0, 0)
    const bc = mk(sw, shh), bx = ctx2d(bc); bx.drawImage(mc, 0, 0, sw, shh)
    const bd = bx.getImageData(0, 0, sw, shh); boxBlurAlpha(bd.data, sw, shh, Math.round(blur / kd / 1.7)); bx.putImageData(bd, 0, 0)
    ox2.globalAlpha = p.shop / 100; ox2.imageSmoothingQuality = 'high'
    ox2.drawImage(bc, ox, oy, sw * kd, shh * kd); ox2.globalAlpha = 1
  }
  ox2.drawImage(cc, 0, 0)
  return out
}

type Pt = [number, number]

// contours iso-0 du champ e (marching squares), reliés en boucles fermées
function isoLoops(e: Float32Array, W: number, H: number): Pt[][] {
  const T = (x: number, y: number) => (y * W + x) * 2, V = (x: number, y: number) => (y * W + x) * 2 + 1
  const segA: number[] = [], segB: number[] = []
  type Edge = 'T' | 'B' | 'L' | 'R'
  const tab: Edge[][] = [[], ['L', 'B'], ['B', 'R'], ['L', 'R'], ['T', 'R'], ['T', 'R', 'L', 'B'], ['T', 'B'], ['L', 'T'],
    ['L', 'T'], ['T', 'B'], ['L', 'T', 'B', 'R'], ['T', 'R'], ['L', 'R'], ['B', 'R'], ['L', 'B'], []]
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x
    const c = (+(e[i]! >= 0) << 3) | (+(e[i + 1]! >= 0) << 2) | (+(e[i + W + 1]! >= 0) << 1) | +(e[i + W]! >= 0)
    if (c === 0 || c === 15) continue
    const id: Record<Edge, number> = { T: T(x, y), B: T(x, y + 1), L: V(x, y), R: V(x + 1, y) }, t = tab[c]!
    for (let j = 0; j < t.length; j += 2) { segA.push(id[t[j]!]); segB.push(id[t[j + 1]!]) }
  }
  const adj = new Map<number, number[]>()
  for (let s = 0; s < segA.length; s++) for (const ed of [segA[s]!, segB[s]!]) { const a = adj.get(ed); if (a) a.push(s); else adj.set(ed, [s]) }
  const pt = (ed: number): Pt => {
    const base = ed >> 1, x = base % W, y = (base - x) / W
    if (ed & 1) { const a = e[base]!, b = e[base + W]!, t = a / (a - b); return [x + 0.5, y + t + 0.5] }
    const a = e[base]!, b = e[base + 1]!, t = a / (a - b); return [x + t + 0.5, y + 0.5]
  }
  const used = new Uint8Array(segA.length), loops: Pt[][] = []
  for (let s = 0; s < segA.length; s++) {
    if (used[s]) continue; used[s] = 1
    const start = segA[s]!, loop = [pt(start)]; let cur = s, ed = segB[s]!, guard = 0
    while (ed !== start && guard++ < 1e7) {
      loop.push(pt(ed))
      const nx = (adj.get(ed) || []).find(o => o !== cur && !used[o])
      if (nx === undefined) break
      used[nx] = 1; ed = segA[nx] === ed ? segB[nx]! : segA[nx]!; cur = nx
    }
    if (loop.length > 4) loops.push(loop)
  }
  return loops
}
function simplifyOpen(pts: Pt[], tol: number): Pt[] {
  const n = pts.length, keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1
  const st: [number, number][] = [[0, n - 1]], t2 = tol * tol
  while (st.length) {
    const [a, b] = st.pop()!; const [ax, ay] = pts[a]!, [bx, by] = pts[b]!
    const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1e-9
    let md = 0, mi = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!; let t = ((px - ax) * dx + (py - ay) * dy) / ll; t = Math.max(0, Math.min(1, t))
      const qx = ax + t * dx - px, qy = ay + t * dy - py, d = qx * qx + qy * qy
      if (d > md) { md = d; mi = i }
    }
    if (md > t2) { keep[mi] = 1; st.push([a, mi], [mi, b]) }
  }
  return pts.filter((_, i) => keep[i])
}
function simplifyClosed(pts: Pt[], tol: number): Pt[] {
  const n = pts.length; let far = 0, fd = -1
  for (let i = 1; i < n; i++) { const d = (pts[i]![0] - pts[0]![0]) ** 2 + (pts[i]![1] - pts[0]![1]) ** 2; if (d > fd) { fd = d; far = i } }
  const a = simplifyOpen(pts.slice(0, far + 1), tol), b = simplifyOpen(pts.slice(far).concat([pts[0]!]), tol)
  return a.concat(b.slice(1, -1))
}

function drawWall(ctx: CanvasRenderingContext2D, W: number, H: number, c: [number, number, number], L: number, seed: number) {
  const q = Math.max(1, Math.round(Math.max(W, H) / 500)), w = Math.ceil(W / q), h = Math.ceil(H / q)
  const t = mk(w, h), tx = ctx2d(t), d = tx.createImageData(w, h), p = d.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x * q / L, v = y * q / L
    const dx = x / w - 0.5, dy = y / h - 0.5, vig = 1 - 0.55 * (dx * dx + dy * dy) * 2
    const n = 0.84 + 0.22 * fbm(u * 2.2, v * 2.2, seed + 300, 4) + 0.09 * fbm(u * 30, v * 30, seed + 400, 2)
    const f = n * vig, k = (y * w + x) * 4
    p[k] = c[0] * f; p[k + 1] = c[1] * f; p[k + 2] = c[2] * f; p[k + 3] = 255
  }
  tx.putImageData(d, 0, 0); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(t, 0, 0, w * q, h * q)
  // grain fin
  const g = mk(256, 256), gx = ctx2d(g), gd = gx.createImageData(256, 256)
  for (let i = 0; i < 65536; i++) { const v = h01(i, 3, seed) * 255; gd.data[i * 4] = gd.data[i * 4 + 1] = gd.data[i * 4 + 2] = v; gd.data[i * 4 + 3] = 22 }
  gx.putImageData(gd, 0, 0); ctx.fillStyle = ctx.createPattern(g, 'repeat')!; ctx.fillRect(0, 0, W, H)
}

/* ---------- recadrage (coordonnées relatives 0..1) ---------- */
export interface Crop { x: number; y: number; w: number; h: number }

export function cropPx(c: Crop, W: number, H: number): [number, number, number, number] {
  const x = Math.round(c.x * W), y = Math.round(c.y * H)
  return [x, y, Math.max(1, Math.min(W - x, Math.round(c.w * W))), Math.max(1, Math.min(H - y, Math.round(c.h * H)))]
}

export function applyCrop(cv: HTMLCanvasElement, crop: Crop | null): HTMLCanvasElement {
  if (!crop) return cv
  const [x, y, w, h] = cropPx(crop, cv.width, cv.height), o = mk(w, h)
  ctx2d(o).drawImage(cv, x, y, w, h, 0, 0, w, h)
  return o
}

/** Ajuste le cadre aux proportions r (largeur / hauteur), centré sur le cadre actuel. */
export function fitRatio(crop: Crop | null, r: number, W: number, H: number): Crop {
  const c = crop || { x: 0, y: 0, w: 1, h: 1 }
  const cx = (c.x + c.w / 2) * W, cy = (c.y + c.h / 2) * H
  let w = c.w * W, h = c.h * H
  if (w / h > r) w = h * r; else h = w / r
  if (Math.abs(w / h - r) > 0.01 || w < 2) { w = W; h = W / r; if (h > H) { h = H; w = H * r } }
  const x = Math.min(Math.max(0, cx - w / 2), W - w), y = Math.min(Math.max(0, cy - h / 2), H - h)
  return { x: x / W, y: y / H, w: w / W, h: h / H }
}

/* ---------- exemple : une fleur dessinée ---------- */
export function sampleFlower(): HTMLCanvasElement {
  const c = mk(900, 1000), x = ctx2d(c)
  x.lineCap = 'round'
  x.strokeStyle = '#3f8a3a'; x.lineWidth = 26
  x.beginPath(); x.moveTo(450, 420); x.bezierCurveTo(470, 600, 400, 760, 450, 980); x.stroke()
  const leaf = (cx: number, cy: number, rot: number, col: string) => {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = col
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(90, -70, 200, 0); x.quadraticCurveTo(90, 70, 0, 0); x.fill()
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 4; x.beginPath(); x.moveTo(10, 0); x.lineTo(185, 0); x.stroke(); x.restore()
  }
  leaf(440, 720, -0.5 - Math.PI, '#4fa046'); leaf(452, 820, -0.35, '#46963e')
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2
    x.save(); x.translate(450, 300); x.rotate(a); x.fillStyle = i % 2 ? '#ef6b5a' : '#f2856f'
    x.beginPath(); x.ellipse(0, -150, 62, 120, 0, 0, Math.PI * 2); x.fill()
    x.strokeStyle = 'rgba(120,20,20,.25)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -60); x.lineTo(0, -230); x.stroke(); x.restore()
  }
  x.fillStyle = '#f4c430'; x.beginPath(); x.arc(450, 300, 92, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#c98a10'
  for (let i = 0; i < 40; i++) {
    const r = Math.sqrt(i / 40) * 78, a = i * 2.399
    x.beginPath(); x.arc(450 + Math.cos(a) * r, 300 + Math.sin(a) * r, 6, 0, Math.PI * 2); x.fill()
  }
  return c
}
