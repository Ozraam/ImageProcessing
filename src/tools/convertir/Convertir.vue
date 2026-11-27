<script setup lang="ts">
import { ScanSearch, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
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
import { baseName, canvasToBlob, formatBytes, formatType } from '@/lib/image'
import { TaskClient } from '@/lib/task-worker'
import { cn } from '@/lib/utils'
import { useImageStore } from '@/stores/image'
import tool from './tool'
import {
  FORMATS, encodableTypes, findMetadata, formatInfo, processConvert, samplePhoto, type ConvertRequest,
} from './render'
import './convertir.css'

/** Diamètre de la loupe (px CSS) et grossissement (pixels de l'image → px CSS) */
const LOUPE = 180
const ZOOM = 3

const store = useImageStore()

const settings = useToolSettings('convertir', {
  format: 'image/webp',
  /** Qualité en %, pour les formats avec perte */
  quality: 80,
  background: '#ffffff',
  /** Position du curseur de comparaison, en % de la largeur */
  split: 50,
  loupe: false,
})

// Encodage dans un Web Worker, avec repli sur la page
const decodeLocal = lastBitmap()
const convertLocal = (req: ConvertRequest) => processConvert(req, decodeLocal)
const client = new TaskClient<ConvertRequest, Blob>(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'convertir' }),
  convertLocal,
)

/* ---------- état (déclaré avant les watch immédiats) ---------- */
const result = shallowRef<{ key: string; blob: Blob; url: string } | null>(null)
const busy = ref(false)
const failed = ref(false)
const available = ref<string[]>(['image/png', 'image/jpeg'])
const meta = ref<{ exif: boolean; gps: boolean; xmp: boolean } | null>(null)
/** Images décodées en pleine résolution pour la loupe */
const before = shallowRef<ImageBitmap | null>(null)
const after = shallowRef<{ key: string; bmp: ImageBitmap } | null>(null)

function setResult(r: { key: string; blob: Blob } | null) {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = r && { ...r, url: URL.createObjectURL(r.blob) }
}

onMounted(async () => {
  available.value = await encodableTypes()
  if (!available.value.includes(settings.value.format)) {
    settings.value.format = available.value.includes('image/webp') ? 'image/webp' : 'image/jpeg'
  }
})
onBeforeUnmount(() => {
  client.dispose()
  setResult(null)
  closeBitmaps()
})

/* ---------- source ---------- */
const src = computed(() => store.current)
const fmt = computed(() => formatInfo(settings.value.format))
const formats = computed(() => FORMATS.filter(f => available.value.includes(f.type)))
/** Aplatir la transparence : seulement si le format ne la garde pas */
const flatten = computed(() => !fmt.value.alpha && !!src.value?.hasAlpha)

watch(
  () => store.current?.id,
  async () => {
    setResult(null)
    closeBitmaps()
    meta.value = null
    const s = store.current
    if (s) meta.value = await findMetadata(s.blob).catch(() => null)
  },
  { immediate: true },
)

/* ---------- encodage en direct ---------- */
function request(): ConvertRequest | null {
  const s = src.value
  if (!s) return null
  return {
    srcId: s.id,
    blob: s.blob,
    type: settings.value.format,
    quality: settings.value.quality / 100,
    background: flatten.value ? settings.value.background : null,
  }
}
const keyOf = (r: ConvertRequest) => `${r.srcId}|${r.type}|${fmt.value.lossy ? r.quality : ''}|${r.background ?? ''}`

/** Encode, et refait le calcul sur la page si le worker ne connaît pas ce format. */
async function encode(req: ConvertRequest, latest: boolean): Promise<Blob | null> {
  try {
    return latest ? await client.latest('apercu', req) : await client.run(req)
  } catch {
    return convertLocal(req)
  }
}

async function refresh() {
  const req = request()
  if (!req) return
  if (result.value?.key === keyOf(req)) { busy.value = false; return }
  busy.value = true
  try {
    const blob = await encode(req, true)
    if (!blob) return
    failed.value = false
    setResult({ key: keyOf(req), blob })
  } catch {
    failed.value = true
    toast.error(`Ce navigateur ne sait pas encoder en ${fmt.value.label}.`)
  } finally {
    const now = request()
    if (!now || result.value?.key === keyOf(now) || failed.value) busy.value = false
  }
}
const scheduleRefresh = useDebounceFn(refresh, 200)
watch(
  [() => store.current?.id, () => settings.value.format, () => settings.value.quality, () => settings.value.background, flatten],
  () => {
    busy.value = !!src.value
    void scheduleRefresh()
  },
  { immediate: true },
)

const current = computed(() => {
  const req = request()
  return req && result.value?.key === keyOf(req) ? result.value : null
})

/* ---------- poids ---------- */
const delta = computed(() => {
  const s = src.value, r = current.value
  if (!s || !r) return null
  return Math.round((r.blob.size / s.blob.size - 1) * 100)
})

/* ---------- comparaison avant / après ---------- */
const frame = ref<HTMLElement | null>(null)
const dragging = ref(false)
const pointer = ref<{ x: number; y: number } | null>(null)
const loupeCanvas = ref<HTMLCanvasElement | null>(null)

function splitAt(e: PointerEvent) {
  const r = frame.value!.getBoundingClientRect()
  settings.value.split = Math.min(100, Math.max(0, Math.round((e.clientX - r.left) / r.width * 1000) / 10))
}

function onDown(e: PointerEvent) {
  if (e.button !== 0 || !frame.value) return
  frame.value.setPointerCapture(e.pointerId)
  dragging.value = true
  splitAt(e)
}

function onMove(e: PointerEvent) {
  if (!frame.value) return
  const r = frame.value.getBoundingClientRect()
  pointer.value = { x: e.clientX - r.left, y: e.clientY - r.top }
  if (dragging.value) splitAt(e)
}

function onUp() {
  dragging.value = false
}

function onKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  if (e.key === 'ArrowLeft') settings.value.split = Math.max(0, settings.value.split - step)
  else if (e.key === 'ArrowRight') settings.value.split = Math.min(100, settings.value.split + step)
  else if (e.key === 'Home') settings.value.split = 0
  else if (e.key === 'End') settings.value.split = 100
  else return
  e.preventDefault()
}

/* ---------- loupe : pixels réels des deux versions ---------- */

function closeBitmaps() {
  before.value?.close()
  before.value = null
  after.value?.bmp.close()
  after.value = null
}

// décodage en pleine résolution, seulement quand la loupe sert
watch(
  [() => settings.value.loupe, () => store.current?.id, current],
  async () => {
    if (!settings.value.loupe) return
    const s = src.value, r = current.value
    try {
      if (s && !before.value) before.value = await createImageBitmap(s.blob)
      if (r && after.value?.key !== r.key) {
        const bmp = await createImageBitmap(r.blob)
        after.value?.bmp.close()
        after.value = { key: r.key, bmp }
      }
    } catch {
      /* la loupe reste vide */
    }
  },
  { immediate: true },
)

const loupeVisible = computed(() => settings.value.loupe && !!pointer.value && !!before.value)

function drawLoupe() {
  const cv = loupeCanvas.value, p = pointer.value, b = before.value, el = frame.value
  if (!cv || !p || !b || !el) return
  const dpr = window.devicePixelRatio || 1
  const size = Math.round(LOUPE * dpr)
  if (cv.width !== size) { cv.width = size; cv.height = size }
  const x = cv.getContext('2d')!
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.clearRect(0, 0, LOUPE, LOUPE)
  x.imageSmoothingEnabled = false
  const r = el.getBoundingClientRect()
  // point visé, en pixels de l'image
  const ix = p.x / r.width * b.width, iy = p.y / r.height * b.height
  const half = LOUPE / 2 / ZOOM
  const draw = (img: ImageBitmap, from: number, to: number) => {
    if (to <= from) return
    x.save()
    x.beginPath()
    x.rect(from, 0, to - from, LOUPE)
    x.clip()
    x.drawImage(img, ix - half, iy - half, half * 2, half * 2, 0, 0, LOUPE, LOUPE)
    x.restore()
  }
  // le trait de comparaison traverse aussi la loupe
  const lx = Math.min(LOUPE, Math.max(0, (settings.value.split / 100 * b.width - ix) * ZOOM + LOUPE / 2))
  draw(b, 0, lx)
  const a = after.value?.key === current.value?.key ? after.value?.bmp : null
  if (a) draw(a, lx, LOUPE)
  if (lx > 0 && lx < LOUPE) {
    x.fillStyle = 'rgba(255,255,255,.9)'
    x.fillRect(lx - 0.75, 0, 1.5, LOUPE)
  }
}
watch([pointer, before, after, () => settings.value.split, loupeCanvas], drawLoupe)

const loupeStyle = computed(() => {
  const p = pointer.value
  return p ? { left: `${p.x - LOUPE / 2}px`, top: `${p.y - LOUPE / 2}px`, width: `${LOUPE}px`, height: `${LOUPE}px` } : {}
})

/* ---------- export ---------- */
const filename = computed(() => {
  const name = src.value?.name ?? 'image'
  const out = `${baseName(name)}.${fmt.value.ext}`
  return out === name ? `${baseName(name)}-compresse.${fmt.value.ext}` : out
})

async function renderFinal() {
  const req = request()
  if (!req) throw new Error('Aucune image')
  if (result.value?.key === keyOf(req)) return result.value.blob
  return (await encode(req, false))!
}

async function useSample() {
  const blob = await canvasToBlob(samplePhoto(), 'image/png')
  await store.importFile(new File([blob], 'exemple-crepuscule.png', { type: 'image/png' }))
}

/* ---------- résumés ---------- */
const formatSummary = computed(() => (fmt.value.lossy ? `${fmt.value.label} · ${settings.value.quality} %` : fmt.value.label))
const metaSummary = computed(() => (meta.value?.exif || meta.value?.xmp ? 'Retirées' : 'Aucune'))
const pct = (v: number) => `${v} %`

/** Une petite image est affichée agrandie (pixels nets) pour rester lisible et comparable. */
const MIN_DISPLAY = 360
const smallStyle = computed(() => {
  const s = src.value
  if (!s || Math.max(s.width, s.height) >= MIN_DISPLAY) return null
  const k = MIN_DISPLAY / Math.max(s.width, s.height)
  return { width: `${Math.round(s.width * k)}px`, imageRendering: 'pixelated' as const }
})
const swatches = ['#ffffff', '#000000', '#f4efe6']
</script>

<template>
  <ToolLayout :tool="tool" :open-sections="['format', 'metadonnees', 'comparer']">
    <template #controls>
      <ToolSection value="format" title="Format & qualité" :summary="formatSummary">
        <ToggleGroup
          :model-value="settings.format"
          type="single"
          variant="outline"
          class="w-full"
          aria-label="Format de sortie"
          @update:model-value="v => { if (v) settings.format = v as string }"
        >
          <ToggleGroupItem v-for="f in formats" :key="f.type" :value="f.type" class="flex-1">{{ f.label }}</ToggleGroupItem>
        </ToggleGroup>

        <ToolSlider v-if="fmt.lossy" v-model="settings.quality" label="Qualité" :min="1" :max="100" :format="pct" />
        <p v-else class="m-0 text-xs text-muted-foreground">
          PNG est sans perte : pas de réglage de qualité. Pour une photo, WebP ou JPEG sont bien plus légers.
        </p>

        <div v-if="flatten" class="flex flex-col gap-2">
          <Label class="text-[13px] font-normal">Fond à la place de la transparence</Label>
          <div class="flex items-center gap-2">
            <button
              v-for="c in swatches"
              :key="c"
              type="button"
              :aria-label="`Fond ${c}`"
              :aria-pressed="settings.background === c"
              :class="cn('size-8 rounded-md border outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                         settings.background === c && 'ring-2 ring-primary ring-offset-2 ring-offset-card')"
              :style="{ background: c }"
              @click="settings.background = c"
            />
            <label class="relative size-8 rounded-md border overflow-hidden cursor-pointer" title="Autre couleur">
              <input v-model="settings.background" type="color" class="absolute -inset-2 size-12 cursor-pointer" aria-label="Autre couleur de fond" />
            </label>
            <span class="font-mono text-xs text-muted-foreground uppercase">{{ settings.background }}</span>
          </div>
          <p class="m-0 text-xs text-muted-foreground">JPEG ne garde pas la transparence : elle est remplacée par cette couleur.</p>
        </div>
      </ToolSection>

      <ToolSection value="metadonnees" title="Métadonnées" :summary="metaSummary">
        <div class="flex gap-2.5 text-[13px]">
          <ShieldCheck class="size-4.5 shrink-0 mt-0.5 text-primary" />
          <div class="flex flex-col gap-1.5">
            <p class="m-0">
              Les métadonnées sont supprimées : l'image est redessinée à partir de ses pixels puis réencodée.
              Rien sur l'appareil photo, la date ou le lieu de prise de vue ne passe dans le fichier exporté.
            </p>
            <p v-if="meta?.gps" class="m-0 font-medium text-primary">
              Cette image contient une position GPS : elle sera retirée.
            </p>
            <p v-else-if="meta?.exif || meta?.xmp" class="m-0 font-medium text-primary">
              Cette image contient des données {{ meta.exif ? 'EXIF' : 'XMP' }} : elles seront retirées.
            </p>
            <p v-else-if="meta" class="m-0 text-muted-foreground">Aucune métadonnée repérée dans cette image.</p>
            <p class="m-0 text-xs text-muted-foreground">L'orientation de l'appareil est appliquée directement aux pixels.</p>
          </div>
        </div>
      </ToolSection>

      <ToolSection value="comparer" title="Comparer" :summary="settings.loupe ? 'Loupe' : `${Math.round(settings.split)} %`">
        <p class="m-0 text-xs text-muted-foreground">
          Faites glisser le trait sur l'aperçu : à gauche l'original, à droite le résultat.
        </p>
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-0.5">
            <Label for="cv-loupe" class="text-[13px] font-normal">Loupe ×{{ ZOOM }}</Label>
            <span class="text-xs text-muted-foreground">Agrandit les vrais pixels sous le pointeur pour juger les artefacts.</span>
          </div>
          <Switch id="cv-loupe" v-model="settings.loupe" />
        </div>
      </ToolSection>
    </template>

    <template #export>
      <dl v-if="src" class="m-0 grid grid-cols-[1fr_auto_1fr] items-end gap-x-3 text-xs">
        <div class="flex flex-col gap-0.5">
          <dt class="text-muted-foreground">Avant · {{ formatType(src.blob.type) }}</dt>
          <dd class="m-0 font-mono tabular-nums text-[15px]">{{ formatBytes(src.blob.size) }}</dd>
        </div>
        <dd
          v-if="delta !== null"
          :class="cn('m-0 font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full mb-0.5',
                     delta <= 0 ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200')"
        >{{ delta > 0 ? '+' : '' }}{{ delta }} %</dd>
        <span v-else />
        <div class="flex flex-col gap-0.5 text-right">
          <dt class="text-muted-foreground">Après · {{ fmt.label }}</dt>
          <dd class="m-0 font-mono tabular-nums text-[15px] font-semibold">{{ current ? formatBytes(current.blob.size) : '…' }}</dd>
        </div>
      </dl>
      <p v-if="delta !== null && delta > 0" class="m-0 text-xs text-muted-foreground">
        Le résultat est plus lourd que l'original : baissez la qualité ou essayez un autre format.
      </p>
      <ToolExport
        :tool="tool"
        :filename="filename"
        :render="renderFinal"
        :disabled="!src || failed"
        :download-label="current ? `Télécharger le ${fmt.label} · ${formatBytes(current.blob.size)}` : `Télécharger le ${fmt.label}`"
      />
    </template>

    <template #stage>
      <ToolStage class="convertir-damier p-6 sm:p-8" :busy="busy">
        <div
          v-if="src"
          ref="frame"
          class="relative max-w-full select-none touch-none shadow-[0_8px_24px_rgba(40,10,50,.22)]"
          :class="settings.loupe ? 'cursor-none' : 'cursor-ew-resize'"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
          @pointerleave="pointer = null"
        >
          <img
            :src="src.url"
            :width="src.width"
            :height="src.height"
            alt="Image d'origine"
            draggable="false"
            class="block max-w-full max-h-[70vh] w-auto h-auto"
            :style="smallStyle ?? undefined"
          />
          <img
            v-if="current"
            :src="current.url"
            :alt="`Résultat en ${fmt.label}`"
            draggable="false"
            class="absolute inset-0 size-full"
            :style="{ clipPath: `inset(0 0 0 ${settings.split}%)`, imageRendering: smallStyle ? 'pixelated' : undefined }"
          />
          <span class="absolute left-2 top-2 text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/55 text-white pointer-events-none whitespace-nowrap">
            Avant · {{ formatType(src.blob.type) }}
          </span>
          <span class="absolute right-2 top-2 text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary text-primary-foreground pointer-events-none whitespace-nowrap">
            Après · {{ formatSummary }}
          </span>
          <div class="absolute inset-y-0 w-0 pointer-events-none" :style="{ left: `${settings.split}%` }">
            <span class="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.25)]" />
          </div>
          <span
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white text-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,.35)] grid place-items-center outline-none focus-visible:ring-3 focus-visible:ring-ring/70"
            :style="{ left: `${settings.split}%` }"
            role="slider"
            tabindex="0"
            aria-label="Comparaison avant / après"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(settings.split)"
            @keydown="onKey"
          >
            <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
              <path d="M6 1 L1 6 L6 11 M12 1 L17 6 L12 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <canvas
            v-show="loupeVisible"
            ref="loupeCanvas"
            class="convertir-damier absolute rounded-full pointer-events-none border-2 border-white shadow-[0_6px_20px_rgba(0,0,0,.4)]"
            :style="loupeStyle"
            aria-hidden="true"
          />
        </div>
        <template #status>
          <span>{{ src?.width }} × {{ src?.height }} px · {{ formatType(src?.blob.type ?? '') }} → {{ fmt.label }}</span>
          <span v-if="settings.loupe" class="inline-flex items-center gap-1"><ScanSearch class="size-3.5" /> loupe ×{{ ZOOM }}</span>
        </template>
      </ToolStage>
    </template>

    <template #empty>
      <Button variant="outline" @click="useSample"><Sparkles /> Essayer avec l'exemple</Button>
    </template>
  </ToolLayout>
</template>
