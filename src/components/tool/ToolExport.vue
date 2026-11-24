<script setup lang="ts">
import { ArrowRight, ChevronDown, Download, Home } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadBlob } from '@/lib/image'
import { useImageStore } from '@/stores/image'
import { tools, toolPath } from '@/tools/registry'
import type { ToolDefinition } from '@/tools/types'

/**
 * Barre d'export commune : télécharger le résultat, ou en faire l'image en cours
 * puis choisir l'outil suivant (ou revenir à l'accueil).
 * Le slot par défaut accueille les options propres à l'outil (taille d'export…).
 */
const props = defineProps<{
  tool: ToolDefinition
  filename: string
  /** Produit le résultat final en pleine résolution */
  render: () => Promise<Blob>
  downloadLabel?: string
  disabled?: boolean
}>()

const store = useImageStore()
const router = useRouter()
const busy = ref(false)
const others = computed(() => tools.filter(t => t.id !== props.tool.id))

async function produce(): Promise<Blob | null> {
  busy.value = true
  try {
    // laisse le navigateur afficher l'état « occupé » avant le calcul
    await new Promise(r => setTimeout(r, 30))
    return await props.render()
  } catch {
    toast.error("Image trop grande pour ce navigateur : choisissez une taille d'export plus petite.")
    return null
  } finally {
    busy.value = false
  }
}

async function download() {
  const blob = await produce()
  if (!blob) return
  downloadBlob(blob, props.filename)
  toast.success('PNG téléchargé')
}

async function continueTo(path: string) {
  const blob = await produce()
  if (!blob) return
  await store.useResult(blob, props.filename, props.tool.id)
  toast.success("Le résultat est maintenant l'image en cours")
  router.push(path)
}
</script>

<template>
  <slot />
  <Button size="lg" class="w-full font-semibold" :disabled="disabled || busy" @click="download">
    <Download /> {{ busy ? 'Rendu en haute résolution…' : (downloadLabel ?? 'Télécharger le PNG') }}
  </Button>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="w-full" :disabled="disabled || busy">
        Continuer avec ce résultat <ChevronDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="center" side="top" class="w-(--reka-dropdown-menu-trigger-width) min-w-56">
      <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
        Le résultat devient l'image en cours. Ouvrir :
      </DropdownMenuLabel>
      <DropdownMenuItem v-for="t in others" :key="t.id" @select="continueTo(toolPath(t))">
        <span class="size-2.5 rounded-[3px]" :style="{ background: t.accent.light }" />
        {{ t.name }}
        <ArrowRight class="ml-auto" />
      </DropdownMenuItem>
      <DropdownMenuItem v-if="!others.length" disabled>Aucun autre outil pour l'instant</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="continueTo('/')"><Home /> Retour à l'accueil</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
