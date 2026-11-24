<script setup lang="ts">
import { computed, useId } from 'vue'
import { Slider } from '@/components/ui/slider'

/** Curseur avec libellé et valeur affichée, pour un nombre. */
const props = withDefaults(defineProps<{
  label: string
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
}>(), { min: 0, max: 100, step: 1 })

const model = defineModel<number>({ required: true })
const id = useId()
const arr = computed({
  get: () => [model.value],
  set: v => { if (v[0] !== undefined) model.value = v[0] },
})
const shown = computed(() => (props.format ? props.format(model.value) : String(model.value).replace('.', ',')))
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex justify-between gap-2">
      <span :id="id" class="text-[13px]">{{ label }}</span>
      <output class="font-mono text-xs text-muted-foreground tabular-nums">{{ shown }}</output>
    </div>
    <Slider v-model="arr" :min="min" :max="max" :step="step" :aria-labelledby="id" />
  </div>
</template>
