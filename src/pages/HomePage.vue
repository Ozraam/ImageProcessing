<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import ImageDropzone from '@/components/shell/ImageDropzone.vue'
import ToolCard from '@/components/shell/ToolCard.vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { formatBytes, formatType } from '@/lib/image'
import { useImageStore } from '@/stores/image'
import { tools, toolById } from '@/tools/registry'
import { cn } from '@/lib/utils'

const store = useImageStore()
const { pick } = useImagePicker()
const cur = computed(() => store.current)

const originLabel = (origin: string) => (origin === 'import' ? 'Importée' : toolById(origin)?.name ?? origin)
</script>

<template>
  <div class="mx-auto max-w-[1240px] px-4 sm:px-5 pt-8 pb-12 flex flex-col gap-9">
    <section class="flex flex-wrap gap-6 items-stretch">
      <div class="flex-[1_1_340px] flex flex-col justify-center gap-2.5">
        <h1 class="m-0 font-extrabold text-[40px] leading-[1.05] tracking-tight">Atelier d'image</h1>
        <p class="m-0 text-muted-foreground max-w-[46ch] text-[15px]">
          Importez une image une fois, puis passez d'un outil à l'autre. Tout se fait dans votre navigateur :
          rien n'est envoyé sur un serveur.
        </p>
      </div>

      <div v-if="cur" class="flex-[2_1_560px] bg-card border rounded-xl p-4 flex flex-wrap gap-5 shadow-xs">
        <img
          :src="cur.url"
          :alt="`Aperçu de ${cur.name}`"
          class="size-42 rounded-lg border object-contain stage-checker shrink-0"
        />
        <div class="flex-[1_1_260px] flex flex-col gap-3 min-w-0">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-muted-foreground font-medium uppercase tracking-wider">Image en cours</span>
            <span class="font-display font-semibold text-[22px] truncate" :title="cur.name">{{ cur.name }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5 text-xs">
            <span class="font-mono px-2 py-0.5 rounded-full bg-secondary">{{ cur.width }} × {{ cur.height }} px</span>
            <span class="font-mono px-2 py-0.5 rounded-full bg-secondary">{{ formatType(cur.blob.type) }} · {{ formatBytes(cur.blob.size) }}</span>
            <span
              :class="cn('px-2 py-0.5 rounded-full font-medium', cur.hasAlpha ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-secondary text-muted-foreground')"
            >{{ cur.hasAlpha ? 'Fond transparent' : 'Sans transparence' }}</span>
          </div>

          <div v-if="store.images.length > 1" class="flex flex-col gap-1.5">
            <span class="text-xs text-muted-foreground">Images de cette session · cliquez pour en refaire l'image en cours</span>
            <ul class="flex flex-wrap gap-2 list-none m-0 p-0">
              <li v-for="img in store.images" :key="img.id">
                <button
                  type="button"
                  :aria-label="`${img.name} (${originLabel(img.origin)})`"
                  :aria-pressed="img.id === store.currentId"
                  :title="`${img.name} · ${originLabel(img.origin)}`"
                  :class="cn('size-11 rounded-md border stage-checker overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                             img.id === store.currentId ? 'ring-2 ring-foreground' : 'opacity-80 hover:opacity-100')"
                  @click="store.select(img.id)"
                >
                  <img :src="img.url" alt="" class="size-full object-contain" />
                </button>
              </li>
            </ul>
          </div>

          <div class="flex flex-wrap gap-2 mt-auto">
            <Button @click="store.download()"><Download /> Télécharger l'image</Button>
            <Button variant="outline" @click="pick">Changer d'image</Button>
            <Button variant="ghost" class="text-muted-foreground" @click="store.clear()">Retirer</Button>
          </div>
        </div>
      </div>

      <ImageDropzone v-else class="flex-[2_1_560px] min-h-50" />
    </section>

    <section class="flex flex-col gap-3.5" aria-labelledby="outils">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="outils" class="m-0 font-semibold text-[22px]">Outils</h2>
        <span class="text-muted-foreground text-[13px]">Chaque outil reçoit l'image en cours.</span>
      </div>
      <div class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        <ToolCard v-for="tool in tools" :key="tool.id" :tool="tool" />
      </div>
    </section>
  </div>
</template>
