<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { tools, toolPath } from '@/tools/registry'
import AppLogo from './AppLogo.vue'
import CurrentImageChip from './CurrentImageChip.vue'

const route = useRoute()
const onTool = computed(() => !!route.meta.tool)
</script>

<template>
  <header class="bg-card border-b sticky top-0 z-30">
    <div class="mx-auto max-w-[1240px] px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
      <RouterLink to="/" class="flex items-center gap-2.5 rounded-md">
        <AppLogo class="size-7" />
        <span class="font-display font-extrabold text-[19px] tracking-tight">Atelier</span>
      </RouterLink>

      <nav aria-label="Navigation principale" class="flex gap-1 flex-1">
        <Button as-child variant="ghost" :class="route.name === 'home' && 'bg-secondary'">
          <RouterLink to="/">Accueil</RouterLink>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" :class="onTool && 'bg-secondary'">
              Outils <ChevronDown class="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="min-w-60">
            <DropdownMenuItem v-for="tool in tools" :key="tool.id" as-child>
              <RouterLink :to="toolPath(tool)" class="flex items-center gap-2.5">
                <span
                  class="size-6 rounded-md grid place-items-center text-white"
                  :style="{ background: tool.accent.light }"
                >
                  <component :is="tool.icon" class="size-3.5 text-white" />
                </span>
                {{ tool.name }}
              </RouterLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <CurrentImageChip />
    </div>
  </header>
</template>
