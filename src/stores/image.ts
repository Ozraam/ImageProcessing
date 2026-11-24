import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { del, get, set } from 'idb-keyval'
import { analyzeImage, downloadBlob } from '@/lib/image'

/**
 * Image en cours, partagée par toutes les pages.
 *
 * - En mémoire (Pinia) pendant la navigation.
 * - Copiée dans IndexedDB pour survivre à un rafraîchissement (F5).
 * - Liée à l'onglet : un identifiant gardé dans sessionStorage permet d'ignorer
 *   (et d'effacer) les images d'un onglet fermé ou d'un autre onglet.
 */

export interface SessionImage {
  id: string
  name: string
  blob: Blob
  width: number
  height: number
  hasAlpha: boolean
  /** 'import' ou l'id de l'outil qui a produit l'image */
  origin: string
  createdAt: number
  /** ObjectURL pour l'affichage (non persisté) */
  url: string
}

type Persisted = {
  sessionId: string
  currentId: string | null
  images: Omit<SessionImage, 'url'>[]
}

const DB_KEY = 'atelier:session'
const SESSION_KEY = 'atelier:session-id'
const MAX_IMAGES = 10

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'memoire'
  }
}

export const useImageStore = defineStore('image', () => {
  const images = shallowRef<SessionImage[]>([])
  const currentId = shallowRef<string | null>(null)
  const current = computed(() => images.value.find(i => i.id === currentId.value) ?? null)

  async function persist() {
    const data: Persisted = {
      sessionId: sessionId(),
      currentId: currentId.value,
      images: images.value.map(({ url: _url, ...rest }) => rest),
    }
    try {
      await set(DB_KEY, data)
    } catch {
      // IndexedDB indisponible (navigation privée…) : l'image reste en mémoire seulement.
    }
  }

  async function restore() {
    try {
      const data = await get<Persisted>(DB_KEY)
      if (!data) return
      if (data.sessionId !== sessionId()) {
        await del(DB_KEY) // images d'un onglet fermé
        return
      }
      images.value = data.images.map(i => ({ ...i, url: URL.createObjectURL(i.blob) }))
      currentId.value = data.currentId
    } catch {
      /* rien à restaurer */
    }
  }

  async function add(blob: Blob, name: string, origin: string) {
    const info = await analyzeImage(blob) // lève une erreur si ce n'est pas une image
    const img: SessionImage = {
      id: crypto.randomUUID(),
      name,
      blob,
      ...info,
      origin,
      createdAt: Date.now(),
      url: URL.createObjectURL(blob),
    }
    const kept = [img, ...images.value]
    for (const old of kept.splice(MAX_IMAGES)) URL.revokeObjectURL(old.url)
    images.value = kept
    currentId.value = img.id
    await persist()
    return img
  }

  /** Importe un fichier choisi par l'utilisateur et en fait l'image en cours. */
  const importFile = (file: File) => add(file, file.name, 'import')

  /** Un outil remplace l'image en cours par son résultat. */
  const useResult = (blob: Blob, name: string, toolId: string) => add(blob, name, toolId)

  async function select(id: string) {
    if (!images.value.some(i => i.id === id)) return
    currentId.value = id
    await persist()
  }

  async function remove(id: string) {
    const img = images.value.find(i => i.id === id)
    if (!img) return
    URL.revokeObjectURL(img.url)
    images.value = images.value.filter(i => i.id !== id)
    if (currentId.value === id) currentId.value = images.value[0]?.id ?? null
    await persist()
  }

  async function clear() {
    for (const i of images.value) URL.revokeObjectURL(i.url)
    images.value = []
    currentId.value = null
    try {
      await del(DB_KEY)
    } catch {
      /* ignoré */
    }
  }

  function download(img: SessionImage | null = current.value) {
    if (img) downloadBlob(img.blob, img.name)
  }

  return { images, currentId, current, restore, importFile, useResult, select, remove, clear, download }
})
