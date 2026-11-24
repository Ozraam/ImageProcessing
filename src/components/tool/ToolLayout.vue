<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Accordion } from '@/components/ui/accordion'
import ImageDropzone from '@/components/shell/ImageDropzone.vue'
import { useImageStore } from '@/stores/image'
import type { ToolDefinition } from '@/tools/types'

/**
 * Gabarit commun à tous les outils :
 * en-tête de l'outil, réglages à gauche (#controls, en sections <ToolSection>),
 * barre d'export (#export), aperçu à droite (#stage).
 * Sans image en cours, l'aperçu est remplacé par une zone de dépôt (#empty pour y ajouter des boutons).
 */
const props = withDefaults(defineProps<{
  tool: ToolDefinition
  /** Sections ouvertes au chargement */
  openSections?: string[]
}>(), { openSections: () => [] })

const store = useImageStore()
</script>

<template>
  <div
    class="tool-scope"
    :style="{ '--tool-accent-light': props.tool.accent.light, '--tool-accent-dark': props.tool.accent.dark }"
  >
    <div class="mx-auto max-w-[1240px] px-4 sm:px-5 pt-5 pb-10 flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <span class="size-10 rounded-[10px] grid place-items-center bg-primary text-primary-foreground shrink-0">
          <component :is="tool.icon" class="size-5" />
        </span>
        <div class="flex flex-col min-w-0 flex-[1_1_260px]">
          <nav aria-label="Fil d'Ariane" class="text-xs text-muted-foreground">
            <RouterLink to="/" class="hover:underline">Accueil</RouterLink> / Outils
          </nav>
          <h1 class="m-0 font-extrabold text-[28px] leading-tight tracking-tight flex items-center gap-2.5">
            {{ tool.name }}
            <Badge v-if="tool.status === 'beta'" variant="secondary" class="font-sans">Bêta</Badge>
          </h1>
        </div>
        <p class="m-0 text-muted-foreground max-w-[52ch] flex-[1_1_320px]">{{ tool.description }}</p>
      </div>

      <div class="flex flex-wrap gap-5 items-start">
        <aside
          class="flex-[1_1_320px] md:max-w-[360px] w-full bg-card border rounded-xl overflow-hidden flex flex-col order-2 md:order-1"
          aria-label="Réglages"
        >
          <Accordion type="multiple" :default-value="openSections" class="flex flex-col">
            <slot name="controls" />
          </Accordion>
          <div v-if="$slots.export" class="p-4 flex flex-col gap-2.5 bg-secondary/50 border-t">
            <slot name="export" />
          </div>
        </aside>

        <section class="flex-[999_1_560px] min-w-0 flex flex-col gap-2.5 order-1 md:order-2 md:sticky md:top-20" aria-label="Aperçu">
          <slot v-if="store.current" name="stage" />
          <ImageDropzone v-else class="min-h-[420px]">
            <slot name="empty" />
          </ImageDropzone>
        </section>
      </div>
    </div>
  </div>
</template>
