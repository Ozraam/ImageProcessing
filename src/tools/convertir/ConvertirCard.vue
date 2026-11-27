<!-- Vignette de la carte d'accueil : un PNG lourd qui devient un WebP léger -->
<script setup lang="ts">
import './convertir.css'
</script>

<template>
  <div class="convertir-damier grid place-items-center">
    <div class="flex items-center gap-3">
      <div class="w-[52px] h-[64px] rounded-[4px] bg-white shadow-[0_4px_12px_rgba(0,0,0,.2)] flex flex-col justify-end p-1.5 gap-1 border border-black/5">
        <span class="h-[26px] rounded-[2px] bg-[linear-gradient(180deg,#2a3f7a,#c86b8a_60%,#f5b971)]" />
        <span class="font-mono text-[9px] font-semibold text-neutral-600 text-center">PNG</span>
      </div>
      <svg class="text-primary" width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
        <path d="M2 8 H22 M16 2 L23 8 L16 14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="w-[44px] h-[54px] rounded-[4px] bg-white shadow-[0_4px_12px_rgba(0,0,0,.2)] flex flex-col justify-end p-1.5 gap-1 border border-black/5">
        <span class="h-[20px] rounded-[2px] bg-[linear-gradient(180deg,#2a3f7a,#c86b8a_60%,#f5b971)]" />
        <span class="font-mono text-[9px] font-semibold text-primary text-center">WEBP</span>
      </div>
    </div>
  </div>
</template>
