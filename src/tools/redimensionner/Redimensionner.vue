<script setup lang="ts">
import { Link2, Link2Off, Sparkles, Undo2 } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ToolLayout from '@/components/tool/ToolLayout.vue'
import ToolSection from '@/components/tool/ToolSection.vue'
import ToolSlider from '@/components/tool/ToolSlider.vue'
import ToolStage from '@/components/tool/ToolStage.vue'
import ToolExport from '@/components/tool/ToolExport.vue'
import { useToolSettings } from '@/composables/useToolSettings'
import { lastBitmap } from '@/lib/canvas'
import { baseName, canvasToBlob, formatBytes } from '@/lib/image'
import { TaskClient } from '@/lib/task-worker'
import { cn } from '@/lib/utils'
import { useImageStore } from '@/stores/image'
import tool from './tool'
import {
  MAX_AREA, MAX_SIDE, PRESETS, presetSize, processResize, samplePixelArt,
  type Method, type Preset, type ResizeRequest,
} from './render'
import './redimensionner.css'

/** Au-delà de cette surface (en pixels), l'aperçu n'est plus recalculé à chaque réglage. */
const LIVE_AREA = 40_000_000

const store = useImageStore()

const settings = useToolSettings('redimensionner', {
  /** Image à laquelle se rapportent les dimensions */
  imageId: '',
  mode: 'px' as 'px' | 'pct',
  width: 0,
  height: 0,
  pct: 100,
  lock: true,
  method: 'lisse' as Method,
  /** Préréglage appliqué (vide dès qu'on modifie les dimensions à la main) */
  preset: '',
})

// Calcul dans un Web Worker, avec repli sur la page
const decodeLocal = lastBitmap()
const client = new TaskClient<ResizeRequest, Blob>(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'redimensionner' }),
  req => processResize(req, decodeLocal),
)
onBeforeUnmount(() => client.dispose())

/* ---------- état du résultat (déclaré avant les watch immédiats) ---------- */
const result = shallowRef<{ key: string; blob: Blob; url: string } | null>(null)
const busy = ref(false)
const actualSize = ref(false)

function setResult(r: { key: string; blob: Blob } | null) {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = r && { ...r, url: URL.createObjectURL(r.blob) }
}
onBeforeUnmount(() => setResult(null))

/* ---------- source ---------- */
const src = computed(() => store.current)
const ratio = computed(() => (src.value ? src.value.width / src.value.height : 1))

function resetSize() {
  const s = src.value
  settings.value.width = s?.width ?? 0
  settings.value.height = s?.height ?? 0
  settings.value.pct = 100
  settings.value.preset = ''
}

watch(
  () => store.current?.id,
  id => {
    setResult(null)
    if (id && settings.value.imageId !== id) {
      settings.value.imageId = id
      settings.value.mode = 'px'
      resetSize()
    }
  },
  { immediate: true },
)

/* ---------- dimensions ---------- */
const target = computed<[number, number]>(() => {
  const s = src.value, st = settings.value
  if (!s) return [0, 0]
  if (st.mode === 'pct') {
    return [Math.max(1, Math.round(s.width * st.pct / 100)), Math.max(1, Math.round(s.height * st.pct / 100))]
  }
  return [Math.max(1, Math.round(st.width) || 1), Math.max(1, Math.round(st.height) || 1)]
})

const tooBig = computed(() => {
  const [w, h] = target.value
  return w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_AREA
})

const scale = computed(() => (src.value ? target.value[0] / src.value.width : 1))

function parse(v: string | number) {
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), 99999) : null
}

function setWidth(v: string | number) {
  const n = parse(v)
  if (n === null) return
  settings.value.width = n
  if (settings.value.lock) settings.value.height = Math.max(1, Math.round(n / ratio.value))
  settings.value.preset = ''
}

function setHeight(v: string | number) {
  const n = parse(v)
  if (n === null) return
  settings.value.height = n
  if (settings.value.lock) settings.value.width = Math.max(1, Math.round(n * ratio.value))
  settings.value.preset = ''
}

function toggleLock() {
  settings.value.lock = !settings.value.lock
  // en reverrouillant, la hauteur reprend les proportions de l'image
  if (settings.value.lock) setWidth(settings.value.width)
}

/** En passant d'un mode à l'autre, on garde la taille obtenue. */
function setMode(mode: 'px' | 'pct') {
  const s = src.value, st = settings.value
  if (!s || mode === st.mode) return
  if (mode === 'px') {
    st.width = Math.max(1, Math.round(s.width * st.pct / 100))
    st.height = Math.max(1, Math.round(s.height * st.pct / 100))
  } else {
    st.pct = Math.min(400, Math.max(1, Math.round(st.width / s.width * 100)))
  }
  st.mode = mode
}

function applyPreset(p: Preset) {
  const s = src.value
  if (!s) return
  const [w, h] = presetSize(p, s.width, s.height)
  settings.value.mode = 'px'
  settings.value.lock = true
  settings.value.width = w
  settings.value.height = h
  settings.value.preset = p.id
}

const pctPresets = [25, 50, 100, 200]
const pctFormat = (v: number) => `${v} %`

/* ---------- format de sortie ---------- */
/** On garde le format de la source quand c'est un JPEG ou un WebP, sinon PNG (sans perte). */
const format = computed(() => {
  const t = src.value?.blob.type
  if (t === 'image/jpeg') return { type: t, ext: 'jpg', label: 'JPEG', quality: 0.92 }
  if (t === 'image/webp') return { type: t, ext: 'webp', label: 'WebP', quality: 0.92 }
  return { type: 'image/png', ext: 'png', label: 'PNG', quality: undefined }
})

function request(): ResizeRequest | null {
  const s = src.value
  if (!s || tooBig.value) return null
  const [width, height] = target.value
  return {
    srcId: s.id, blob: s.blob, width, height, method: settings.value.method,
    type: format.value.type, quality: format.value.quality,
  }
}
const keyOf = (r: ResizeRequest) => `${r.srcId}|${r.width}|${r.height}|${r.method}|${r.type}`

/* ---------- aperçu : le vrai résultat, calculé en arrière-plan ---------- */
const live = computed(() => target.value[0] * target.value[1] <= LIVE_AREA)

async function refresh() {
  const req = request()
  if (!req || !live.value) { busy.value = false; return }
  if (result.value?.key === keyOf(req)) { busy.value = false; return }
  busy.value = true
  try {
    const blob = await client.latest('apercu', req)
    if (!blob) return // remplacé par une demande plus récente
    setResult({ key: keyOf(req), blob })
  } catch {
    toast.error("Impossible de redimensionner l'image à cette taille.")
  } finally {
    const now = request()
    if (!now || result.value?.key === keyOf(now)) busy.value = false
  }
}
const scheduleRefresh = useDebounceFn(refresh, 250)
watch([target, () => settings.value.method, () => store.current?.id], () => {
  busy.value = live.value && !tooBig.value
  void scheduleRefresh()
}, { immediate: true })

const shownUrl = computed(() => {
  const req = request()
  return req && result.value?.key === keyOf(req) ? result.value.url : null
})

/* ---------- export ---------- */
const filename = computed(() => {
  const [w, h] = target.value
  return `${baseName(src.value?.name ?? 'image')}-${w}x${h}.${format.value.ext}`
})

async function renderFinal() {
  const req = request()
  if (!req) throw new Error('Dimensions invalides')
  if (result.value?.key === keyOf(req)) return result.value.blob
  return client.run(req)
}

function resetAll() {
  settings.value.mode = 'px'
  settings.value.lock = true
  settings.value.method = 'lisse'
  resetSize()
}
const isPristine = computed(() => {
  const s = src.value
  return !s || (target.value[0] === s.width && target.value[1] === s.height && settings.value.method === 'lisse')
})

async function useSample() {
  const blob = await canvasToBlob(samplePixelArt(), 'image/png')
  await store.importFile(new File([blob], 'exemple-pixel-art.png', { type: 'image/png' }))
  await nextTick() // laisse le watch de l'image réinitialiser les réglages d'abord
  settings.value.method = 'net'
  settings.value.mode = 'pct'
  settings.value.pct = 400
}

/* ---------- résumés ---------- */
const sizeSummary = computed(() => `${target.value[0]} × ${target.value[1]}`)
const methodSummary = computed(() => (settings.value.method === 'net' ? 'Pixels nets' : 'Lissé'))
const scaleLabel = computed(() => {
  const k = scale.value
  if (Math.abs(k - 1) < 1e-3) return 'taille identique'
  const pct = Math.round(k * 1000) / 10
  return `${k > 1 ? 'agrandie' : 'réduite'} à ${String(pct).replace('.', ',')} %`
})
/** Un petit résultat est affiché agrandi pour rester visible (la taille réelle reste à un clic). */
const MIN_DISPLAY = 320
const imgStyle = computed(() => {
  const [w, h] = target.value
  if (actualSize.value) return { width: `${w}px`, height: `${h}px` }
  const m = Math.max(w, h)
  if (m >= MIN_DISPLAY) return { aspectRatio: `${w} / ${h}` }
  return { width: `${Math.round(w * MIN_DISPLAY / m)}px`, aspectRatio: `${w} / ${h}` }
})
const afterWeight = computed(() => (shownUrl.value && result.value ? formatBytes(result.value.blob.size) : null))
</script>

<template>
  <ToolLayout :tool="tool" :open-sections="['taille', 'prereglages', 'qualite']">
    <template #controls>
      <ToolSection value="taille" title="Taille" :summary="sizeSummary">
        <ToggleGroup
          :model-value="settings.mode"
          type="single"
          variant="outline"
          class="w-full"
          aria-label="Unité"
          @update:model-value="v => { if (v) setMode(v as 'px' | 'pct') }"
        >
          <ToggleGroupItem value="px" class="flex-1">Pixels</ToggleGroupItem>
          <ToggleGroupItem value="pct" class="flex-1">Pourcentage</ToggleGroupItem>
        </ToggleGroup>

        <div v-if="settings.mode === 'px'" class="flex items-end gap-2">
          <div class="flex-1 flex flex-col gap-1.5">
            <Label for="redim-w" class="text-[13px] font-normal">Largeur (px)</Label>
            <Input
              id="redim-w"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_SIDE"
              class="font-mono tabular-nums"
              :model-value="settings.width"
              @update:model-value="setWidth"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            :aria-pressed="settings.lock"
            :title="settings.lock ? 'Proportions verrouillées' : 'Proportions libres'"
            :aria-label="settings.lock ? 'Déverrouiller les proportions' : 'Verrouiller les proportions'"
            :class="settings.lock && 'text-primary border-primary/50'"
            @click="toggleLock"
          >
            <Link2 v-if="settings.lock" />
            <Link2Off v-else />
          </Button>
          <div class="flex-1 flex flex-col gap-1.5">
            <Label for="redim-h" class="text-[13px] font-normal">Hauteur (px)</Label>
            <Input
              id="redim-h"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_SIDE"
              class="font-mono tabular-nums"
              :model-value="settings.height"
              @update:model-value="setHeight"
            />
          </div>
        </div>

        <template v-else>
          <ToolSlider v-model="settings.pct" label="Échelle" :min="1" :max="400" :format="pctFormat" />
          <div class="grid grid-cols-4 gap-2">
            <Button
              v-for="p in pctPresets"
              :key="p"
              variant="outline"
              size="sm"
              :class="settings.pct === p && 'border-primary text-primary'"
              @click="settings.pct = p"
            >{{ p }} %</Button>
          </div>
        </template>

        <p v-if="tooBig" class="m-0 text-xs text-destructive">
          Trop grand pour un navigateur : {{ MAX_SIDE }} px au plus par côté et {{ MAX_AREA / 1_000_000 }} millions de pixels en tout.
        </p>
        <p v-else-if="settings.mode === 'px' && !settings.lock" class="m-0 text-xs text-muted-foreground">
          Proportions libres : l'image sera déformée si le rapport largeur/hauteur change.
        </p>
      </ToolSection>

      <ToolSection value="prereglages" title="Préréglages" :summary="PRESETS.find(p => p.id === settings.preset)?.label">
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="p in PRESETS"
            :key="p.id"
            type="button"
            :aria-pressed="settings.preset === p.id"
            :class="cn(
              'text-left rounded-md border px-3 py-2 flex flex-col gap-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              settings.preset === p.id ? 'border-primary bg-primary/10' : 'hover:bg-secondary/60',
            )"
            @click="applyPreset(p)"
          >
            <span class="text-[13px] font-medium">{{ p.label }}</span>
            <span class="text-[11px] font-mono text-muted-foreground">{{ p.detail }}</span>
          </button>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          L'image tient dans le format choisi sans être déformée ; le cadre suit son orientation.
        </p>
      </ToolSection>

      <ToolSection value="qualite" title="Qualité" :summary="methodSummary">
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            <Label for="redim-net" class="text-[13px] font-normal">Pixels nets</Label>
            <span class="text-xs text-muted-foreground">
              Plus proche voisin : chaque pixel devient un carré net. Pour agrandir du pixel art.
            </span>
          </div>
          <Switch
            id="redim-net"
            :model-value="settings.method === 'net'"
            @update:model-value="v => settings.method = v ? 'net' : 'lisse'"
          />
        </div>
        <p v-if="settings.method === 'lisse' && scale < 0.5" class="m-0 text-xs text-muted-foreground">
          Forte réduction : elle se fait par paliers successifs pour garder une image douce, sans crénelage.
        </p>
      </ToolSection>
    </template>

    <template #export>
      <dl v-if="src" class="m-0 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-xs">
        <span />
        <dt class="text-muted-foreground">Avant</dt>
        <dt class="text-muted-foreground">Après</dt>
        <dt class="text-muted-foreground">Taille</dt>
        <dd class="m-0 font-mono tabular-nums">{{ src.width }} × {{ src.height }}</dd>
        <dd class="m-0 font-mono tabular-nums font-semibold">{{ target[0] }} × {{ target[1] }}</dd>
        <dt class="text-muted-foreground">Poids</dt>
        <dd class="m-0 font-mono tabular-nums">{{ formatBytes(src.blob.size) }}</dd>
        <dd class="m-0 font-mono tabular-nums font-semibold">
          {{ afterWeight ?? (tooBig ? '—' : live ? '…' : 'au téléchargement') }}
        </dd>
      </dl>
      <Button variant="ghost" class="w-full" :disabled="isPristine" @click="resetAll">
        <Undo2 /> Taille d'origine
      </Button>
      <ToolExport
        :tool="tool"
        :filename="filename"
        :render="renderFinal"
        :disabled="!src || tooBig"
        :download-label="`Télécharger le ${format.label}`"
      />
    </template>

    <template #stage>
      <ToolStage class="redim-papier p-6 sm:p-8" :busy="busy">
        <div
          :class="actualSize ? 'max-w-full max-h-[70vh] overflow-auto rounded-sm' : 'contents'"
          tabindex="-1"
        >
          <img
            :src="shownUrl ?? src?.url"
            :width="target[0]"
            :height="target[1]"
            :alt="`Aperçu redimensionné à ${target[0]} × ${target[1]} px`"
            :class="cn(
              'block shadow-[0_8px_24px_rgba(60,30,10,.25)] transition-opacity',
              actualSize ? 'max-w-none' : 'max-w-full max-h-[70vh] w-auto h-auto object-contain',
              settings.method === 'net' && 'redim-pixelated',
              !shownUrl && 'opacity-60',
            )"
            :style="imgStyle"
          />
        </div>
        <template #status>
          <span>{{ src?.width }} × {{ src?.height }} → {{ target[0] }} × {{ target[1]}} px · {{ scaleLabel }}</span>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <Switch v-model="actualSize" class="scale-90" />
            Taille réelle
          </label>
        </template>
      </ToolStage>
    </template>

    <template #empty>
      <Button variant="outline" @click="useSample"><Sparkles /> Essayer avec l'exemple</Button>
    </template>
  </ToolLayout>
</template>
