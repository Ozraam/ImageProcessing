<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useImagePicker } from '@/composables/useImagePicker'

// Coller une image (Ctrl/Cmd + V) n'importe où en fait l'image en cours.
const { importImage } = useImagePicker()
useEventListener(window, 'paste', (e: ClipboardEvent) => {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  const file = [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'))
  if (file) {
    e.preventDefault()
    importImage(file)
  }
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="min-h-dvh flex flex-col">
      <AppHeader />
      <main class="flex-1">
        <RouterView />
      </main>
    </div>
    <Toaster position="bottom-center" />
  </TooltipProvider>
</template>
