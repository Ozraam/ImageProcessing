<script setup lang="ts">
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

/** Une section repliable du panneau de réglages. */
defineProps<{ value: string; title: string; summary?: string }>()
</script>

<template>
  <AccordionItem :value="value" class="border-b last:border-b-0">
    <AccordionTrigger class="px-4 py-3.5 hover:no-underline hover:bg-secondary/40 rounded-none items-center">
      <span class="font-display font-semibold text-[15px]">{{ title }}</span>
      <span v-if="summary" class="ml-auto text-xs text-muted-foreground font-normal">{{ summary }}</span>
    </AccordionTrigger>
    <AccordionContent class="px-4">
      <div class="flex flex-col gap-4 pt-0.5">
        <slot />
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
