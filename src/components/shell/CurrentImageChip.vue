<script setup lang="ts">
import { Download, Upload, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useImageStore } from '@/stores/image'
import { useImagePicker } from '@/composables/useImagePicker'

const store = useImageStore()
const { pick } = useImagePicker()
</script>

<template>
  <div v-if="store.current" class="flex items-center gap-2 rounded-lg border bg-popover p-1 pr-1.5 max-w-full">
    <img
      :src="store.current.url"
      alt=""
      class="size-9 rounded-md object-contain stage-checker shrink-0"
    />
    <div class="flex flex-col leading-tight min-w-0">
      <span class="text-[11px] text-muted-foreground">Image en cours</span>
      <span class="text-[13px] font-semibold truncate max-w-[16ch]" :title="store.current.name">{{ store.current.name }}</span>
    </div>
    <span class="font-mono text-xs text-muted-foreground hidden md:inline">
      {{ store.current.width }} × {{ store.current.height }}
    </span>
    <Button variant="outline" size="sm" @click="pick">Changer</Button>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon-sm" aria-label="Télécharger l'image en cours" @click="store.download()">
          <Download />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Télécharger l'image en cours</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon-sm" aria-label="Retirer l'image" class="text-muted-foreground" @click="store.clear()">
          <X />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Retirer l'image</TooltipContent>
    </Tooltip>
  </div>
  <Button v-else @click="pick"><Upload /> Importer une image</Button>
</template>
