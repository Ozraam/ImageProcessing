/**
 * Client du rendu : envoie le travail au Web Worker et, si le navigateur ne
 * sait pas dessiner hors du thread principal (pas d'OffscreenCanvas), calcule
 * sur place avec le même code.
 */
import { applyCrop, render, type Crop, type DecoupeParams } from './render'
import type { WorkerRequest, WorkerResponse } from './protocol'

export interface PreviewResult {
  image: ImageBitmap | HTMLCanvasElement
  ms: number
}

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof Path2D !== 'undefined'

export class DecoupeRenderer {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private latestPreview = 0
  // repli sur le thread principal : images décodées à la demande seulement
  private srcBlob: Blob | null = null
  private bgBlob: Blob | null = null
  private decoded = new Map<Blob, Promise<ImageBitmap>>()

  constructor() {
    if (!canUseWorker()) return
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'decoupe-papier' })
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const p = this.pending.get(e.data.id)
        if (!p) return
        this.pending.delete(e.data.id)
        if (e.data.type === 'error') p.reject(new Error(e.data.message))
        else p.resolve(e.data)
      }
      this.worker.onerror = () => this.fallBack()
    } catch {
      this.worker = null
    }
  }

  /** Le worker a planté : on bascule sur le thread principal. */
  private fallBack() {
    console.warn('Découpe papier : rendu en arrière-plan indisponible, calcul sur la page.')
    this.worker?.terminate()
    this.worker = null
    for (const p of this.pending.values()) p.reject(new Error('Le rendu en arrière-plan a échoué'))
    this.pending.clear()
  }

  private send(msg: WorkerRequest & { id: number }): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      this.pending.set(msg.id, { resolve, reject })
      this.worker!.postMessage(msg)
    })
  }

  /** Décode les images pour le repli, et libère celles qui ne servent plus. */
  private async local(): Promise<[ImageBitmap | null, ImageBitmap | null]> {
    for (const [blob, bmp] of this.decoded) {
      if (blob !== this.srcBlob && blob !== this.bgBlob) {
        this.decoded.delete(blob)
        bmp.then(b => b.close()).catch(() => {})
      }
    }
    const get = (blob: Blob | null) => {
      if (!blob) return null
      let bmp = this.decoded.get(blob)
      if (!bmp) this.decoded.set(blob, (bmp = createImageBitmap(blob)))
      return bmp
    }
    return Promise.all([get(this.srcBlob), get(this.bgBlob)])
  }

  /** Image à traiter (null : aucune) */
  setSource(blob: Blob | null) {
    this.srcBlob = blob
    this.worker?.postMessage({ type: 'source', blob } satisfies WorkerRequest)
  }

  /** Image de fond pour le mode « Image » */
  setBackground(blob: Blob | null) {
    this.bgBlob = blob
    this.worker?.postMessage({ type: 'background', blob } satisfies WorkerRequest)
  }

  /** Aperçu basse résolution. Renvoie null si une demande plus récente l'a remplacé. */
  async preview(params: DecoupeParams, size: number): Promise<PreviewResult | null> {
    const id = this.nextId++
    this.latestPreview = id
    if (this.worker) {
      const r = await this.send({ type: 'preview', id, params: { ...params }, size })
      if (r.type !== 'preview') return null
      if (id !== this.latestPreview) { r.image.close(); return null }
      return { image: r.image, ms: r.ms }
    }
    const [src, bg] = await this.local()
    if (!src || id !== this.latestPreview) return null
    const t0 = performance.now()
    const image = render(src, params, size, bg) as HTMLCanvasElement
    return { image, ms: performance.now() - t0 }
  }

  /** Rendu final en pleine résolution, recadré, en PNG. */
  async export(params: DecoupeParams, size: number, crop: Crop | null): Promise<Blob> {
    const id = this.nextId++
    if (this.worker) {
      const r = await this.send({ type: 'export', id, params: { ...params }, size, crop: crop && { ...crop } })
      if (r.type !== 'export') throw new Error('Rendu interrompu')
      return r.blob
    }
    const [src, bg] = await this.local()
    if (!src) throw new Error('Aucune image source')
    const out = applyCrop(render(src, params, size, bg), crop) as HTMLCanvasElement
    return new Promise((resolve, reject) => out.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion impossible'))), 'image/png'))
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
    for (const bmp of this.decoded.values()) bmp.then(b => b.close()).catch(() => {})
    this.decoded.clear()
  }
}
