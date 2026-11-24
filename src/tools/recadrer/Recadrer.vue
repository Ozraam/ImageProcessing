<script setup lang="ts">
import {
  FlipHorizontal2, FlipVertical2, Maximize, RectangleHorizontal, RectangleVertical,
  RotateCcw, RotateCw, Sparkles, Undo2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ToolLayout from '@/components/tool/ToolLayout.vue'
import ToolSection from '@/components/tool/ToolSection.vue'
import ToolSlider from '@/components/tool/ToolSlider.vue'
import ToolStage from '@/components/tool/ToolStage.vue'
import ToolExport from '@/components/tool/ToolExport.vue'
import { useToolSettings } from '@/composables/useToolSettings'
import { baseName, canvasToBlob, decodeImage } from '@/lib/image'
import { useImageStore } from '@/stores/image'
import tool from './tool'
import {
  FULL, IDENTITY, fitInside, flip, frameSize, maxCentered, outputSize, rotateQuarter,
  toNorm, toPx, towards, type Crop, type Mat,
} from './geometry'
import { renderTransformed, sampleLandscape } from './render'
import './recadrer.css'

/** Plus grand côté de l'aperçu, en pixels (assez pour un écran haute densité) */
const PREVIEW_SIZE = 1400

const store = useImageStore()

/*
 * Tout l'état est gardé dans les réglages de l'outil, pour survivre à un F5.
 * `imageId` indique à quelle image se rapportent la rotation et le cadre.
 */
const settings = useToolSettings('recadrer', {
  ratio: 'free',
  portrait: false,
  imageId: '',
  mat: IDENTITY as Mat,
  angle: 0,
  crop: FULL as Crop,
  /** Le cadre suit automatiquement l'angle (tant que l'utilisateur ne l'a pas déplacé) */
  auto: true,
})

/* ---------- proportions ---------- */
const ratios = [
  { value: 'free', label: 'Libre' },
  { value: 'orig', label: 'Originale' },
  { value: '1:1', label: '1:1 carré' },
  { value: '5:4', label: '5:4' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
]
const flippable = computed(() => !['free', 'orig', '1:1'].includes(settings.value.ratio))
const ratioLabel = (r: { value: string; label: string }) =>
  settings.value.portrait && !['free', 'orig', '1:1'].includes(r.value) ? r.value.split(':').reverse().join(':') : r.label

/* ---------- source ---------- */
const preview = shallowRef<ImageBitmap | null>(null)
const view = ref<HTMLCanvasElement | null>(null)
const busy = ref(false)
const fineGrid = ref(false)

/** Dimensions du cadre de travail en pixels de la source */
const frame = computed<[number, number]>(() => {
  const s = store.current
  return s ? frameSize(settings.value.mat, s.width, s.height) : [1, 1]
})

/** Proportions demandées (largeur / hauteur en pixels), ou null si libre */
const ratioVal = computed<number | null>(() => {
  const r = settings.value.ratio
  if (r === 'free') return null
  if (r === 'orig') return frame.value[0] / frame.value[1]
  const [a, b] = r.split(':').map(Number) as [number, number]
  return settings.value.portrait ? b / a : a / b
})

function resetState() {
  settings.value.mat = IDENTITY
  settings.value.angle = 0
  settings.value.crop = FULL
  settings.value.auto = true
  applyAuto()
}

/** Recalcule le plus grand cadre centré aux proportions voulues */
function applyAuto() {
  const [W, H] = frame.value, s = settings.value
  const c = s.crop
  const r = ratioVal.value ?? (s.auto ? W / H : (c.w * W) / (c.h * H))
  settings.value.crop = toNorm(maxCentered(r, W, H, s.angle), W, H)
}

let loadToken = 0
watch(
  () => store.current?.id,
  async id => {
    const s = store.current
    if (!s || !id) { preview.value?.close(); preview.value = null; return }
    if (settings.value.imageId !== id) {
      settings.value.imageId = id
      settings.value.ratio = 'free'
      settings.value.portrait = false
      resetState()
    }
    const token = ++loadToken
    busy.value = true
    try {
      const k = Math.min(1, PREVIEW_SIZE / Math.max(s.width, s.height))
      const bmp = await createImageBitmap(s.blob, {
        resizeWidth: Math.max(1, Math.round(s.width * k)),
        resizeHeight: Math.max(1, Math.round(s.height * k)),
        resizeQuality: 'high',
      })
      if (token !== loadToken) { bmp.close(); return }
      preview.value?.close()
      preview.value = bmp
    } catch {
      toast.error("Impossible de lire cette image.")
    } finally {
      if (token === loadToken) busy.value = false
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => { preview.value?.close(); clearTimeout(gridTimer) })

async function useSample() {
  const blob = await canvasToBlob(sampleLandscape(), 'image/jpeg', 0.92)
  await store.importFile(new File([blob], 'exemple-mer.jpg', { type: 'image/jpeg' }))
}

/* ---------- aperçu ---------- */
function draw() {
  const cv = view.value, bmp = preview.value
  if (!cv || !bmp) return
  const out = renderTransformed(bmp, { mat: settings.value.mat, angle: settings.value.angle }, null)
  cv.width = out.width
  cv.height = out.height
  cv.getContext('2d')!.drawImage(out, 0, 0)
}
watch([view, preview, () => settings.value.mat, () => settings.value.angle], draw)

/* ---------- actions ---------- */
let gridTimer: ReturnType<typeof setTimeout> | undefined
watch(() => settings.value.angle, (a, old) => {
  if (old === undefined || a === old) return
  const [W, H] = frame.value
  if (settings.value.auto) applyAuto()
  else settings.value.crop = toNorm(fitInside(toPx(settings.value.crop, W, H), W, H, a), W, H)
  // grille fine pendant le redressement, pour aligner l'horizon
  fineGrid.value = true
  clearTimeout(gridTimer)
  gridTimer = setTimeout(() => { fineGrid.value = false }, 1200)
})

watch([() => settings.value.ratio, () => settings.value.portrait], (_v, old) => {
  if (!old) return
  if (ratioVal.value === null) return // passage en « libre » : on garde le cadre
  settings.value.auto = true
  applyAuto()
})

function turn(dir: 1 | -1) {
  const s = settings.value
  const [t, c] = rotateQuarter({ mat: s.mat, angle: s.angle }, s.crop, dir)
  s.mat = t.mat
  s.crop = c
  // le cadre a tourné avec l'image : ses proportions s'inversent aussi
  if (flippable.value) s.portrait = !s.portrait
}

function mirror(axis: 'h' | 'v') {
  const s = settings.value
  const [t, c] = flip({ mat: s.mat, angle: s.angle }, s.crop, axis)
  s.mat = t.mat
  s.angle = t.angle
  s.crop = c
}

function maximize() {
  settings.value.auto = true
  applyAuto()
}

function resetAll() {
  settings.value.ratio = 'free'
  settings.value.portrait = false
  resetState()
}

const isPristine = computed(() => {
  const s = settings.value, c = s.crop
  return s.angle === 0 && s.mat.join() === IDENTITY.join() && c.x < 1e-4 && c.y < 1e-4 && c.w > 0.9999 && c.h > 0.9999
})

/* ---------- manipulation du cadre ---------- */
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const handles: { h: Exclude<Handle, 'move'>; cls: string; cursor: string }[] = [
  { h: 'nw', cls: 'left-0 top-0', cursor: 'nwse-resize' },
  { h: 'ne', cls: 'left-full top-0', cursor: 'nesw-resize' },
  { h: 'sw', cls: 'left-0 top-full', cursor: 'nesw-resize' },
  { h: 'se', cls: 'left-full top-full', cursor: 'nwse-resize' },
  { h: 'n', cls: 'left-1/2 top-0', cursor: 'ns-resize' },
  { h: 's', cls: 'left-1/2 top-full', cursor: 'ns-resize' },
  { h: 'w', cls: 'left-0 top-1/2', cursor: 'ew-resize' },
  { h: 'e', cls: 'left-full top-1/2', cursor: 'ew-resize' },
]

const overlay = ref<HTMLElement | null>(null)
let drag: { handle: Handle; start: Crop; px: number; py: number; id: number } | null = null
const dragging = ref<Handle | null>(null)

/** Position du pointeur en pixels du cadre de travail */
function pointer(e: PointerEvent): [number, number] {
  const r = overlay.value!.getBoundingClientRect(), [W, H] = frame.value
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]
}

function onDown(e: PointerEvent, handle: Handle) {
  if (e.button !== 0 || !overlay.value) return
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const [W, H] = frame.value, [px, py] = pointer(e)
  drag = { handle, start: toPx(settings.value.crop, W, H), px, py, id: e.pointerId }
  dragging.value = handle
}

function candidate(handle: Handle, s: Crop, px: number, py: number, dx: number, dy: number): Crop {
  const [W, H] = frame.value
  if (handle === 'move') return { ...s, x: s.x + dx, y: s.y + dy }
  const min = 0.04 * Math.max(W, H)
  const r = ratioVal.value
  const hasE = handle.includes('e'), hasW = handle.includes('w')
  const hasN = handle.includes('n'), hasS = handle.includes('s')
  if (!r) {
    let { x, y, w, h } = s
    if (hasE) w = Math.max(min, px - s.x)
    if (hasW) { w = Math.max(min, s.x + s.w - px); x = s.x + s.w - w }
    if (hasS) h = Math.max(min, py - s.y)
    if (hasN) { h = Math.max(min, s.y + s.h - py); y = s.y + s.h - h }
    return { x, y, w, h }
  }
  const minW = Math.max(min, min * r)
  if (handle.length === 2) {
    // coin : le coin opposé reste fixe, le plus grand des deux déplacements l'emporte
    const ax = hasE ? s.x : s.x + s.w, ay = hasS ? s.y : s.y + s.h
    const dw = Math.max(0, hasE ? px - ax : ax - px), dh = Math.max(0, hasS ? py - ay : ay - py)
    const w = Math.max(minW, dw, dh * r), h = w / r
    return { x: hasE ? ax : ax - w, y: hasS ? ay : ay - h, w, h }
  }
  if (hasE || hasW) {
    const w = Math.max(minW, hasE ? px - s.x : s.x + s.w - px), h = w / r
    return { x: hasE ? s.x : s.x + s.w - w, y: s.y + s.h / 2 - h / 2, w, h }
  }
  const h = Math.max(minW / r, hasS ? py - s.y : s.y + s.h - py), w = h * r
  return { x: s.x + s.w / 2 - w / 2, y: hasS ? s.y : s.y + s.h - h, w, h }
}

function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const [W, H] = frame.value, [px, py] = pointer(e)
  const target = candidate(drag.handle, drag.start, px, py, px - drag.px, py - drag.py)
  const cur = toPx(settings.value.crop, W, H)
  const next = drag.handle === 'move'
    ? moveWithin(cur, target, W, H)
    : towards(cur, target, W, H, settings.value.angle)
  settings.value.crop = toNorm(next, W, H)
  settings.value.auto = false
}

/** Déplacement : on glisse le long des bords au lieu de s'y bloquer */
function moveWithin(cur: Crop, target: Crop, W: number, H: number): Crop {
  const a = settings.value.angle
  const both = towards(cur, target, W, H, a)
  const onlyX = towards(both, { ...both, x: target.x }, W, H, a)
  return towards(onlyX, { ...onlyX, y: target.y }, W, H, a)
}

function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  dragging.value = null
}

function onKey(e: KeyboardEvent) {
  const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const v = d[e.key]
  if (!v) return
  e.preventDefault()
  const [W, H] = frame.value, step = (e.shiftKey ? 0.05 : 0.005) * Math.max(W, H)
  const cur = toPx(settings.value.crop, W, H)
  settings.value.crop = toNorm(moveWithin(cur, { ...cur, x: cur.x + v[0] * step, y: cur.y + v[1] * step }, W, H), W, H)
  settings.value.auto = false
}

const pctStyle = computed(() => {
  const c = settings.value.crop
  return { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }
})

/* ---------- résultat ---------- */
const outSize = computed(() => {
  const s = store.current
  return s ? outputSize({ mat: settings.value.mat, angle: settings.value.angle }, settings.value.crop, s.width, s.height) : [0, 0]
})
const dims = computed(() => {
  const s = store.current
  return s ? `source ${s.width} × ${s.height} px · résultat ${outSize.value[0]} × ${outSize.value[1]} px` : '—'
})

/** On garde le format de la source quand c'est un JPEG ou un WebP, sinon PNG (sans perte). */
const format = computed(() => {
  const t = store.current?.blob.type
  if (t === 'image/jpeg') return { type: t, ext: 'jpg', label: 'JPEG' }
  if (t === 'image/webp') return { type: t, ext: 'webp', label: 'WebP' }
  return { type: 'image/png', ext: 'png', label: 'PNG' }
})
const filename = computed(() => `${baseName(store.current?.name ?? 'image')}-recadre.${format.value.ext}`)

async function renderFinal() {
  const s = store.current
  if (!s) throw new Error('Aucune image')
  const bmp = await decodeImage(s.blob)
  try {
    const out = renderTransformed(bmp, { mat: settings.value.mat, angle: settings.value.angle }, settings.value.crop)
    return await canvasToBlob(out, format.value.type, format.value.type === 'image/png' ? undefined : 0.95)
  } finally {
    bmp.close()
  }
}

/* ---------- résumés ---------- */
const ratioSummary = computed(() => {
  const r = ratios.find(x => x.value === settings.value.ratio)
  return r ? ratioLabel(r) : ''
})
const rotSummary = computed(() => {
  const s = settings.value, m = s.mat
  const mirrored = m[0] * m[3] - m[1] * m[2] < 0
  // décomposition : miroir horizontal éventuel, puis quarts de tour horaires
  const q = Math.round((mirrored ? Math.atan2(-m[2], -m[0]) : Math.atan2(m[2], m[0])) / (Math.PI / 2))
  const parts = [['', '¼ tour', '½ tour', '¾ tour'][(q + 4) % 4], mirrored ? 'miroir' : '', s.angle ? deg(s.angle) : '']
  return parts.filter(Boolean).join(' · ') || 'Aucune'
})
const deg = (v: number) => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}°`
</script>

<template>
  <ToolLayout :tool="tool" :open-sections="['cadre', 'rotation']">
    <template #controls>
      <ToolSection value="cadre" title="Cadre" :summary="ratioSummary">
        <div class="flex items-center gap-2">
          <Select v-model="settings.ratio">
            <SelectTrigger class="flex-1 min-w-32" aria-label="Proportions du cadre"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in ratios" :key="r.value" :value="r.value">{{ ratioLabel(r) }}</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup
            v-if="flippable"
            :model-value="settings.portrait ? 'portrait' : 'paysage'"
            type="single"
            variant="outline"
            aria-label="Orientation du cadre"
            @update:model-value="v => { if (v) settings.portrait = v === 'portrait' }"
          >
            <ToggleGroupItem value="paysage" aria-label="Paysage" title="Paysage"><RectangleHorizontal /></ToggleGroupItem>
            <ToggleGroupItem value="portrait" aria-label="Portrait" title="Portrait"><RectangleVertical /></ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button variant="outline" @click="maximize"><Maximize /> Cadre maximal</Button>
        <p class="m-0 text-xs text-muted-foreground">
          Faites glisser le cadre ou ses poignées sur l'aperçu. Les flèches du clavier le déplacent finement
          (Maj : plus vite).
        </p>
      </ToolSection>

      <ToolSection value="rotation" title="Rotation & miroir" :summary="rotSummary">
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="turn(-1)"><RotateCcw /> ¼ tour gauche</Button>
          <Button variant="outline" @click="turn(1)"><RotateCw /> ¼ tour droite</Button>
          <Button variant="outline" @click="mirror('h')"><FlipHorizontal2 /> Miroir horizontal</Button>
          <Button variant="outline" @click="mirror('v')"><FlipVertical2 /> Miroir vertical</Button>
        </div>
        <ToolSlider v-model="settings.angle" label="Redresser" :min="-45" :max="45" :step="0.1" :format="deg" />
        <p class="m-0 text-xs text-muted-foreground">
          Le cadre se resserre pour ne jamais laisser de coin vide.
        </p>
      </ToolSection>
    </template>

    <template #export>
      <Button variant="ghost" class="w-full" :disabled="isPristine && settings.ratio === 'free'" @click="resetAll">
        <Undo2 /> Tout réinitialiser
      </Button>
      <ToolExport
        :tool="tool"
        :filename="filename"
        :render="renderFinal"
        :disabled="!preview"
        :download-label="`Télécharger le ${format.label}`"
      />
    </template>

    <template #stage>
      <ToolStage class="recadrer-table p-6 sm:p-8" :busy="busy">
        <div class="relative max-w-full">
          <canvas
            ref="view"
            width="10"
            height="10"
            aria-label="Aperçu de l'image et du cadre"
            class="block max-w-full max-h-[70vh] w-auto h-auto"
          />
          <div v-if="preview" ref="overlay" class="absolute inset-0 touch-none select-none">
            <!-- assombrit tout ce qui sort du cadre -->
            <div class="absolute inset-0 overflow-hidden pointer-events-none">
              <div class="absolute shadow-[0_0_0_100vmax_rgba(12,14,22,.62)]" :style="pctStyle" />
            </div>
            <div
              class="absolute outline-none focus-visible:ring-3 focus-visible:ring-ring/70"
              :style="pctStyle"
              :class="dragging === 'move' ? 'cursor-grabbing' : 'cursor-move'"
              tabindex="0"
              role="group"
              aria-label="Cadre de recadrage : flèches pour le déplacer"
              @pointerdown="onDown($event, 'move')"
              @pointermove="onMove"
              @pointerup="onUp"
              @pointercancel="onUp"
              @keydown="onKey"
            >
              <div class="absolute inset-0 border border-white/90 pointer-events-none">
                <template v-for="i in (fineGrid ? 8 : 2)" :key="i">
                  <span
                    class="absolute inset-y-0 w-px"
                    :class="fineGrid ? 'bg-white/30' : 'bg-white/45'"
                    :style="{ left: `${i * 100 / (fineGrid ? 9 : 3)}%` }"
                  />
                  <span
                    class="absolute inset-x-0 h-px"
                    :class="fineGrid ? 'bg-white/30' : 'bg-white/45'"
                    :style="{ top: `${i * 100 / (fineGrid ? 9 : 3)}%` }"
                  />
                </template>
              </div>
              <span
                v-for="hd in handles"
                :key="hd.h"
                class="absolute size-7 -translate-x-1/2 -translate-y-1/2 grid place-items-center"
                :class="hd.cls"
                :style="{ cursor: hd.cursor }"
                @pointerdown="onDown($event, hd.h)"
                @pointermove="onMove"
                @pointerup="onUp"
                @pointercancel="onUp"
              >
                <span
                  class="bg-white shadow-[0_0_0_1px_rgba(0,0,0,.35)] rounded-[2px]"
                  :class="hd.h.length === 2 ? 'size-3' : (hd.h === 'n' || hd.h === 's') ? 'w-5 h-1.5' : 'w-1.5 h-5'"
                />
              </span>
            </div>
          </div>
        </div>
        <template #status>
          <span>{{ dims }}</span><span>{{ format.label }}</span>
        </template>
      </ToolStage>
    </template>

    <template #empty>
      <Button variant="outline" @click="useSample"><Sparkles /> Essayer avec l'exemple</Button>
    </template>
  </ToolLayout>
</template>
