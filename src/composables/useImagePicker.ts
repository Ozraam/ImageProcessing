import { useFileDialog } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { useImageStore } from '@/stores/image'

/** Ouvre le sélecteur de fichiers et importe l'image choisie comme image en cours. */
export function useImagePicker() {
  const store = useImageStore()
  const { open, onChange, reset } = useFileDialog({ accept: 'image/*', multiple: false, reset: true })

  onChange(files => {
    const f = files?.[0]
    if (f) importImage(f)
    reset()
  })

  async function importImage(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error("Ce fichier n'est pas une image.")
      return
    }
    try {
      await store.importFile(file)
      toast.success(`${file.name} est l'image en cours`)
    } catch {
      toast.error('Impossible de lire cette image.')
    }
  }

  return { pick: () => open(), importImage }
}
