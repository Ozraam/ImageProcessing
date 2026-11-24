<script setup lang="ts">
import { ref } from 'vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { cn } from '@/lib/utils'

/**
 * Cadre de l'aperçu. Chaque outil lui donne son propre motif via `class`
 * (tapis de coupe, damier…). Déposer un fichier dessus change l'image en cours.
 */
const props = defineProps<{ class?: string; busy?: boolean }>()
const { importImage } = useImagePicker()
const over = ref(false)

function onDrop(e: DragEvent) {
  over.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) importImage(f)
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
  <div
    :class="cn('relative rounded-xl min-h-[420px] grid place-items-center overflow-hidden',
               over && 'outline-3 outline-dashed outline-primary -outline-offset-8', props.class)"
    @dragenter.prevent="over = true"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <slot />
    <span
      v-if="busy"
      class="absolute right-3 bottom-2.5 font-mono text-[11px] text-white bg-black/50 px-2 py-0.5 rounded-full"
      role="status"
    >rendu…</span>
    <div v-if="$slots.overlay" class="absolute inset-0 pointer-events-none">
      <slot name="overlay" />
    </div>
  </div>
  <div v-if="$slots.status" class="flex justify-between gap-3 flex-wrap font-mono text-xs text-muted-foreground">
    <slot name="status" />
  </div>
  </div>
</template>
