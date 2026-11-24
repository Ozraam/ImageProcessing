<script setup lang="ts">
import { ImageIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useImagePicker } from '@/composables/useImagePicker'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const { pick, importImage } = useImagePicker()
const over = ref(false)

function onDrop(e: DragEvent) {
  over.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) importImage(f)
}
</script>

<template>
  <div
    :class="cn(
      'rounded-xl border-2 border-dashed border-border bg-card/60 flex flex-col items-center justify-center gap-2.5 p-6 text-center transition-colors',
      over && 'border-primary bg-card',
      props.class,
    )"
    @dragenter.prevent="over = true"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <ImageIcon class="size-9 text-muted-foreground" :stroke-width="1.6" aria-hidden="true" />
    <p class="font-semibold text-[15px] m-0">Déposez une image ici</p>
    <p class="text-muted-foreground m-0">ou collez-la (Ctrl + V), ou</p>
    <div class="flex flex-wrap justify-center gap-2">
      <Button @click="pick">Parcourir…</Button>
      <slot />
    </div>
  </div>
</template>
