<script setup lang="ts">
import { RefreshCw, Sparkles, TriangleAlert } from 'lucide-vue-next'
import { useDebounceFn, useEventListener, useFileDialog } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { applyCrop, cropPx, defaultParams, fitRatio, render, sampleFlower, type Crop, type DecoupeParams } from './render'

const PREVIEW_SIZE = 760

const store = useImageStore()
const settings = useToolSettings('decoupe-papier', { ...defaultParams, outsize: '3000', ratio: 'free' })
const params = computed<DecoupeParams>(() => {
  const { outsize: _o, ratio: _r, ...p } = settings.value
  return p
})

/* ---------- image source et fond ---------- */
const src = shallowRef<ImageBitmap | null>(null)
const crop = ref<Crop | null>(null)
const cropMode = ref(false)
const bgImg = shallowRef<ImageBitmap | null>(null)

watch(
  () => store.current?.id,
  async () => {
    const blob = store.current?.blob
    src.value?.close()
    src.value = null
    crop.value = null
    cropMode.value = false
    settings.value.ratio = 'free'
    if (!blob) return
    try {
      src.value = await decodeImage(blob)
    } catch {
      toast.error('Impossible de lire cette image.')
    }
  },
  { immediate: true },
)

const bgDialog = useFileDialog({ accept: 'image/*', multiple: false, reset: true })
bgDialog.onChange(async files => {
  const f = files?.[0]
  if (!f) return
  try {
    bgImg.value?.close()
    bgImg.value = await decodeImage(f)
  } catch {
    toast.error('Impossible de lire cette image de fond.')
  }
})

onBeforeUnmount(() => {
  src.value?.close()
  bgImg.value?.close()
})

async function useSample() {
  const blob = await canvasToBlob(sampleFlower())
  await store.importFile(new File([blob], 'exemple-fleur.png', { type: 'image/png' }))
}

/* ---------- aperçu ---------- */
const view = ref<HTMLCanvasElement | null>(null)
const busy = ref(false)
const timing = ref('')
const lastFull = shallowRef<HTMLCanvasElement | null>(null)

const ratioVal = computed(() => (settings.value.ratio === 'free' ? 0 : parseFloat(settings.value.ratio)))

function preview() {
  if (!src.value) return
  const t0 = performance.now()
  lastFull.value = render(src.value, params.value, PREVIEW_SIZE, bgImg.value)
  if (crop.value && ratioVal.value) crop.value = fitRatio(crop.value, ratioVal.value, lastFull.value.width, lastFull.value.height)
  draw()
  busy.value = false
  timing.value = `aperçu ${Math.round(performance.now() - t0)} ms`
}
const schedulePreview = useDebounceFn(preview, 90)
watch([params, src, bgImg], () => {
  if (!src.value) return
  busy.value = true
  schedulePreview()
}, { deep: true, immediate: true })
watch(view, v => { if (v) draw() })

function draw() {
  const cv = view.value, full = lastFull.value
  if (!cv || !full) return
  const ctx = cv.getContext('2d')!
  if (!cropMode.value) {
    const o = applyCrop(full, crop.value)
    cv.width = o.width; cv.height = o.height; ctx.drawImage(o, 0, 0)
    return
  }
  const W = full.width, H = full.height
  cv.width = W; cv.height = H; ctx.drawImage(full, 0, 0)
  const [x, y, w, h] = cropPx(crop.value || { x: 0, y: 0, w: 1, h: 1 }, W, H)
  const k = W / Math.max(1, cv.getBoundingClientRect().width || W)
  ctx.fillStyle = 'rgba(10,20,15,.6)'
  ctx.fillRect(0, 0, W, y); ctx.fillRect(0, y + h, W, H - y - h); ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, W - x - w, h)
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = k
  ctx.beginPath()
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h)
    ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3)
  }
  ctx.stroke()
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k; ctx.strokeRect(x, y, w, h)
  const hs = 9 * k; ctx.fillStyle = '#fff'
  for (const [a, b] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) ctx.fillRect(a - hs / 2, b - hs / 2, hs, hs)
}
useEventListener(window, 'resize', () => { if (cropMode.value) draw() })

const dims = computed(() => {
  const full = lastFull.value, s = src.value
  if (!full || !s) return '—'
  const scale = Math.min(1, PREVIEW_SIZE / Math.max(s.width, s.height))
  const fw = full.width / scale, fh = full.height / scale
  const c = crop.value
  const ow = Math.round(c ? c.w * fw : fw), oh = Math.round(c ? c.h * fh : fh)
  return `source ${s.width} × ${s.height} px · export ≈ ${ow} × ${oh} px`
})

/* ---------- recadrage ---------- */
function setCropMode(on: boolean) {
  cropMode.value = on
  const full = lastFull.value
  if (on && !crop.value) crop.value = { x: 0, y: 0, w: 1, h: 1 }
  if (on && full && ratioVal.value) crop.value = fitRatio(crop.value, ratioVal.value, full.width, full.height)
  if (!on && crop.value && crop.value.w > 0.995 && crop.value.h > 0.995) crop.value = null
  draw()
}
function resetCrop() {
  crop.value = null
  settings.value.ratio = 'free'
  setCropMode(false)
}
watch(() => settings.value.ratio, (_r, old) => {
  if (old === undefined) return
  const full = lastFull.value
  if (!ratioVal.value || !full) { draw(); return }
  crop.value = fitRatio({ x: 0, y: 0, w: 1, h: 1 }, ratioVal.value, full.width, full.height)
  if (!cropMode.value) setCropMode(true); else draw()
})

type Drag = { type: 'move'; sx: number; sy: number; ox: number; oy: number; w: number; h: number } | { type: 'resize'; ax: number; ay: number }
let drag: Drag | null = null
const cursor = ref('')

function pt(e: PointerEvent): [number, number] {
  const cv = view.value!, r = cv.getBoundingClientRect()
  return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]
}
function onPointerDown(e: PointerEvent) {
  const cv = view.value
  if (!cropMode.value || !lastFull.value || !cv || !crop.value) return
  e.preventDefault(); cv.setPointerCapture(e.pointerId)
  const W = cv.width, H = cv.height, [px, py] = pt(e), [x, y, w, h] = cropPx(crop.value, W, H)
  const tol = 16 * W / cv.getBoundingClientRect().width
  const corners = [[x, y, x + w, y + h], [x + w, y, x, y + h], [x, y + h, x + w, y], [x + w, y + h, x, y]] as const
  const hit = corners.find(([cx, cy]) => Math.abs(px - cx) < tol && Math.abs(py - cy) < tol)
  if (hit) drag = { type: 'resize', ax: hit[2], ay: hit[3] }
  else if (px > x && px < x + w && py > y && py < y + h) drag = { type: 'move', sx: px, sy: py, ox: x, oy: y, w, h }
  else drag = { type: 'resize', ax: px, ay: py }
}
function onPointerMove(e: PointerEvent) {
  const cv = view.value
  if (!cropMode.value || !lastFull.value || !cv || !crop.value) return
  const W = cv.width, H = cv.height, [px, py] = pt(e)
  if (!drag) {
    const [x, y, w, h] = cropPx(crop.value, W, H), tol = 16 * W / cv.getBoundingClientRect().width
    const nearX = Math.abs(px - x) < tol ? 'l' : Math.abs(px - x - w) < tol ? 'r' : ''
    const nearY = Math.abs(py - y) < tol ? 't' : Math.abs(py - y - h) < tol ? 'b' : ''
    cursor.value = nearX && nearY ? ((nearX === 'l') === (nearY === 't') ? 'nwse-resize' : 'nesw-resize')
      : (px > x && px < x + w && py > y && py < y + h) ? 'move' : 'crosshair'
    return
  }
  if (drag.type === 'move') {
    const nx = Math.min(Math.max(0, drag.ox + px - drag.sx), W - drag.w), ny = Math.min(Math.max(0, drag.oy + py - drag.sy), H - drag.h)
    crop.value = { x: nx / W, y: ny / H, w: drag.w / W, h: drag.h / H }
  } else {
    const { ax, ay } = drag, sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1
    const maxW = sx > 0 ? W - ax : ax, maxH = sy > 0 ? H - ay : ay
    let w = Math.min(Math.abs(px - ax), maxW), h = Math.min(Math.abs(py - ay), maxH)
    const r = ratioVal.value
    if (r) {
      if (w / Math.max(h, 1e-6) > r) w = h * r; else h = w / r
      if (w > maxW) { w = maxW; h = w / r }
      if (h > maxH) { h = maxH; w = h * r }
    }
    w = Math.max(w, 12); h = Math.max(h, 12)
    const x = sx > 0 ? ax : ax - w, y = sy > 0 ? ay : ay - h
    crop.value = { x: Math.max(0, x) / W, y: Math.max(0, y) / H, w: Math.min(w, W) / W, h: Math.min(h, H) / H }
  }
  draw()
}
const onPointerUp = () => { drag = null }

/* ---------- export ---------- */
const filename = computed(() => `${baseName(store.current?.name ?? 'decoupe')}-papier.png`)
async function renderFinal() {
  if (!src.value) throw new Error('Aucune image')
  const out = applyCrop(render(src.value, params.value, parseInt(settings.value.outsize, 10), bgImg.value), crop.value)
  return canvasToBlob(out)
}

function reseed() {
  settings.value.seed = (settings.value.seed * 48271 + 11) % 100000
}

/* ---------- résumés des sections ---------- */
const bgLabels: Record<DecoupeParams['bgmode'], string> = { wall: 'Mur texturé', color: 'Couleur unie', image: 'Image', none: 'Transparent' }
const ratios = [
  { value: 'free', label: 'Libre' },
  { value: '1', label: '1:1 carré' },
  { value: '0.8', label: '4:5 portrait' },
  { value: '1.5', label: '3:2' },
  { value: '1.7778', label: '16:9' },
  { value: '0.5625', label: '9:16 story' },
]
const pct = (v: number) => `${String(v).replace('.', ',')} %`
</script>

<template>
  <ToolLayout :tool="tool" :open-sections="['decoupe', 'papier']">
    <template #controls>
      <ToolSection value="decoupe" title="Découpe" :summary="settings.cut === 'round' ? 'Arrondie' : 'Coups de ciseaux'">
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Style de coupe</span>
          <ToggleGroup
            v-model="settings.cut"
            type="single"
            variant="outline"
            class="w-full"
            aria-label="Style de coupe"
            @update:model-value="v => { if (!v) settings.cut = 'round' }"
          >
            <ToggleGroupItem value="round" class="flex-1">Arrondie</ToggleGroupItem>
            <ToggleGroupItem value="straight" class="flex-1">Coups de ciseaux</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ToolSlider v-if="settings.cut === 'straight'" v-model="settings.cutlen" label="Longueur des coups" />
        <ToolSlider v-model="settings.border" label="Largeur du bord" :min="0.5" :max="10" :step="0.5" :format="pct" />
        <ToolSlider v-model="settings.irr" label="Coup de ciseaux irrégulier" />
        <ToolSlider v-model="settings.smooth" label="Simplifier le contour" />
        <div class="flex items-center justify-between gap-3">
          <Label for="holes" class="font-normal">Boucher les trous intérieurs</Label>
          <Switch id="holes" v-model="settings.holes" />
        </div>
      </ToolSection>

      <ToolSection value="papier" title="Papier" :summary="settings.paper">
        <div class="flex items-center justify-between gap-3">
          <Label for="paper" class="font-normal">Couleur du papier</Label>
          <input id="paper" v-model="settings.paper" type="color" class="h-8 w-11 rounded-md border bg-background p-0.5 cursor-pointer" />
        </div>
        <ToolSlider v-model="settings.crumple" label="Froissé" />
        <ToolSlider v-model="settings.cscale" label="Taille des plis" />
        <ToolSlider v-model="settings.subj" label="Plis visibles sur le sujet" />
        <Button variant="outline" @click="reseed"><RefreshCw /> Froisser autrement</Button>
      </ToolSection>

      <ToolSection value="ombre" title="Ombre" :summary="`${settings.shop} %`">
        <ToolSlider v-model="settings.shop" label="Opacité" />
        <ToolSlider v-model="settings.shblur" label="Flou" />
        <ToolSlider v-model="settings.shx" label="Décalage horizontal" :min="-50" :max="50" />
        <ToolSlider v-model="settings.shy" label="Décalage vertical" :min="-50" :max="50" />
      </ToolSection>

      <ToolSection value="fond" title="Fond" :summary="bgLabels[settings.bgmode]">
        <div class="flex items-center gap-2.5 flex-wrap">
          <Select v-model="settings.bgmode">
            <SelectTrigger class="flex-1 min-w-36" aria-label="Type de fond"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(label, v) in bgLabels" :key="v" :value="v">{{ label }}</SelectItem>
            </SelectContent>
          </Select>
          <input
            v-if="settings.bgmode === 'wall' || settings.bgmode === 'color'"
            v-model="settings.bgcolor"
            type="color"
            aria-label="Couleur du fond"
            class="h-9 w-11 rounded-md border bg-background p-0.5 cursor-pointer"
          />
          <Button v-if="settings.bgmode === 'image'" variant="outline" @click="bgDialog.open()">
            {{ bgImg ? 'Changer l\'image…' : 'Image de fond…' }}
          </Button>
        </div>
        <ToolSlider v-model="settings.margin" label="Marge autour" :max="40" :format="pct" />
      </ToolSection>

      <ToolSection value="recadrage" title="Recadrage" :summary="crop ? 'Cadre actif' : 'Aucun'">
        <div class="flex items-center gap-2 flex-wrap">
          <Select v-model="settings.ratio">
            <SelectTrigger class="flex-1 min-w-32" aria-label="Proportions du cadre"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in ratios" :key="r.value" :value="r.value">{{ r.label }}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" @click="setCropMode(!cropMode)">{{ cropMode ? 'Valider' : 'Recadrer' }}</Button>
          <Button v-if="crop" variant="ghost" @click="resetCrop">Retirer</Button>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          Le cadre coupe l'image finale, comme sur un visuel où le papier sort du bord.
        </p>
      </ToolSection>
    </template>

    <template #export>
      <ToolExport :tool="tool" :filename="filename" :render="renderFinal" :disabled="!src">
        <div class="flex items-center justify-between gap-2">
          <Label for="outsize" class="font-normal">Taille d'export</Label>
          <Select v-model="settings.outsize">
            <SelectTrigger id="outsize" size="sm" class="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3000">Originale (max 3000 px)</SelectItem>
              <SelectItem value="2000">2000 px</SelectItem>
              <SelectItem value="1200">1200 px</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ToolExport>
    </template>

    <template #stage>
      <div
        v-if="store.current && !store.current.hasAlpha"
        class="flex gap-2.5 items-start rounded-lg bg-warn text-warn-foreground px-3 py-2.5 text-[13px]"
        role="note"
      >
        <TriangleAlert class="size-4 shrink-0 mt-0.5" />
        <span>
          Cette image n'a pas de transparence, donc tout le rectangle est découpé. Détourez d'abord le sujet
          (sur Mac : Aperçu → Outils → Supprimer l'arrière-plan), puis réimportez le PNG.
        </span>
      </div>
      <ToolStage class="decoupe-mat pt-7 pr-4.5 pb-4.5 pl-7" :busy="busy">
        <canvas
          ref="view"
          width="10"
          height="10"
          aria-label="Aperçu du résultat"
          class="block max-w-full max-h-[72vh] w-auto h-auto rounded-[2px]"
          :class="cropMode && 'touch-none'"
          :style="{ cursor: cropMode ? cursor || 'crosshair' : '' }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        />
        <Button
          v-if="cropMode"
          class="absolute left-1/2 bottom-3 -translate-x-1/2 shadow-lg"
          @click="setCropMode(false)"
        >Valider le cadre</Button>
        <template #status>
          <span>{{ dims }}</span><span>{{ timing }}</span>
        </template>
      </ToolStage>
    </template>

    <template #empty>
      <Button variant="outline" @click="useSample"><Sparkles /> Essayer avec l'exemple</Button>
    </template>
  </ToolLayout>
</template>

<style>
/* Motif propre à cet outil : le tapis de coupe vert, avec ses règles graduées */
.decoupe-mat {
  --mat: #1f5b44;
  --mat-line: rgba(255, 255, 255, 0.1);
  --mat-mark: rgba(255, 255, 255, 0.35);
  background-color: var(--mat);
  background-image:
    linear-gradient(var(--mat-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--mat-line) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: 27px 27px;
}
.dark .decoupe-mat {
  --mat: #173f30;
  --mat-line: rgba(255, 255, 255, 0.07);
  --mat-mark: rgba(255, 255, 255, 0.28);
}
.decoupe-mat.relative::before,
.decoupe-mat.relative::after {
  content: "";
  position: absolute;
  pointer-events: none;
}
.decoupe-mat.relative::before {
  left: 0; right: 0; top: 0; height: 18px;
  background-image: linear-gradient(90deg, var(--mat-mark) 1px, transparent 1px);
  background-size: 24px 8px;
  background-repeat: repeat-x;
  background-position: 27px 0;
}
.decoupe-mat.relative::after {
  top: 0; bottom: 0; left: 0; width: 18px;
  background-image: linear-gradient(var(--mat-mark) 1px, transparent 1px);
  background-size: 8px 24px;
  background-repeat: repeat-y;
  background-position: 0 27px;
}
</style>
