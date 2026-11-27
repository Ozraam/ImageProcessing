/**
 * Petit protocole commun aux outils qui calculent dans un Web Worker :
 * la page envoie une demande, le worker renvoie un résultat.
 *
 * Côté worker : `serveTasks(handler)`. Côté page : `new TaskClient(créer, repli)`,
 * où `repli` exécute le même calcul sur la page quand le worker est indisponible
 * (pas d'OffscreenCanvas, ou plantage).
 */

type Envelope<Req> = { id: number; req: Req }
type Reply<Res> = { id: number; ok: true; res: Res } | { id: number; ok: false; message: string }

export interface TaskOutput<Res> {
  res: Res
  transfer?: Transferable[]
}

/** À appeler dans le worker : les demandes sont traitées une par une, dans l'ordre. */
export function serveTasks<Req, Res>(handler: (req: Req) => Promise<TaskOutput<Res>>) {
  const scope = self as unknown as {
    postMessage(message: Reply<Res>, transfer: Transferable[]): void
    onmessage: ((e: MessageEvent<Envelope<Req>>) => void) | null
  }
  let queue: Promise<void> = Promise.resolve()
  scope.onmessage = e => {
    const { id, req } = e.data
    queue = queue.then(async () => {
      try {
        const out = await handler(req)
        scope.postMessage({ id, ok: true, res: out.res }, out.transfer ?? [])
      } catch (err) {
        scope.postMessage({ id, ok: false, message: String((err as Error)?.message ?? err) }, [])
      }
    })
  }
}

type Pending<Res> = { resolve: (r: Res) => void; reject: (e: Error) => void }
type Waiting<Req, Res> = { req: Req; resolve: (r: Res | null) => void; reject: (e: Error) => void }

export const canUseOffscreenWorker = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'

export class TaskClient<Req, Res> {
  private worker: Worker | null = null
  private pending = new Map<number, Pending<Res>>()
  private nextId = 1
  private waiting = new Map<string, Waiting<Req, Res>>()
  private running = new Set<string>()

  /**
   * @param create crée le worker (`new Worker(new URL('./worker.ts', import.meta.url), …)`
   *               doit être écrit dans l'outil pour que Vite le trouve)
   * @param local  même calcul, sur la page
   */
  constructor(create: () => Worker, private local: (req: Req) => Promise<Res>) {
    if (!canUseOffscreenWorker()) return
    try {
      this.worker = create()
      this.worker.onmessage = (e: MessageEvent<Reply<Res>>) => {
        const p = this.pending.get(e.data.id)
        if (!p) return
        this.pending.delete(e.data.id)
        if (e.data.ok) p.resolve(e.data.res)
        else p.reject(new Error(e.data.message))
      }
      this.worker.onerror = () => this.fallBack()
    } catch {
      this.worker = null
    }
  }

  /** Le worker a planté : on bascule sur la page. */
  private fallBack() {
    console.warn('Calcul en arrière-plan indisponible : calcul sur la page.')
    this.worker?.terminate()
    this.worker = null
    for (const p of this.pending.values()) p.reject(new Error('Le calcul en arrière-plan a échoué'))
    this.pending.clear()
  }

  /** Exécute une demande (dans le worker si possible). */
  run(req: Req): Promise<Res> {
    const w = this.worker
    if (!w) return this.local(req)
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      w.postMessage({ id, req } satisfies Envelope<Req>)
    })
  }

  /**
   * Pour les aperçus : seule la dernière demande d'un canal compte. Une demande
   * remplacée avant d'avoir démarré renvoie null sans être calculée.
   */
  latest(channel: string, req: Req): Promise<Res | null> {
    return new Promise((resolve, reject) => {
      this.waiting.get(channel)?.resolve(null)
      this.waiting.set(channel, { req, resolve, reject })
      if (!this.running.has(channel)) void this.pump(channel)
    })
  }

  private async pump(channel: string) {
    const next = this.waiting.get(channel)
    if (!next) return
    this.waiting.delete(channel)
    this.running.add(channel)
    try {
      next.resolve(await this.run(next.req))
    } catch (err) {
      next.reject(err as Error)
    } finally {
      this.running.delete(channel)
      void this.pump(channel)
    }
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    for (const w of this.waiting.values()) w.resolve(null)
    this.waiting.clear()
    this.pending.clear()
  }
}
