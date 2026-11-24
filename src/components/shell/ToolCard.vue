<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import type { ToolDefinition } from '@/tools/types'
import { toolPath } from '@/tools/registry'

const props = defineProps<{ tool: ToolDefinition }>()
const Preview = props.tool.card ? defineAsyncComponent(props.tool.card) : null
</script>

<template>
  <RouterLink
    :to="toolPath(tool)"
    class="group bg-card text-card-foreground border rounded-xl overflow-hidden flex flex-col transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
    :style="{ '--tool-accent-light': tool.accent.light, '--tool-accent-dark': tool.accent.dark }"
  >
    <div class="h-33 grid place-items-center overflow-hidden tool-scope">
      <component :is="Preview" v-if="Preview" class="size-full" />
      <div v-else class="size-full grid place-items-center bg-primary/10">
        <component :is="tool.icon" class="size-12 text-primary" :stroke-width="1.5" />
      </div>
    </div>
    <div class="px-4 pt-3.5 pb-4 flex flex-col gap-1.5 flex-1 tool-scope">
      <div class="flex items-center gap-2">
        <span class="size-7 rounded-md grid place-items-center bg-primary text-primary-foreground">
          <component :is="tool.icon" class="size-4" />
        </span>
        <span class="font-display font-semibold text-[17px]">{{ tool.name }}</span>
        <Badge v-if="tool.status === 'beta'" variant="secondary" class="ml-auto">Bêta</Badge>
      </div>
      <p class="m-0 text-muted-foreground text-[13px]">{{ tool.description }}</p>
      <span class="mt-auto pt-1.5 text-primary font-semibold text-[13px] inline-flex items-center gap-1">
        Ouvrir <ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  </RouterLink>
</template>
