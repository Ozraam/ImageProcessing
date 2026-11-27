<!-- Vignette de la carte d'accueil : une image et sa version agrandie sur papier millimétré -->
<script setup lang="ts">
import './redimensionner.css'
</script>

<template>
  <div class="redim-papier grid place-items-center">
    <div class="relative w-[132px] h-[88px]">
      <div class="absolute inset-0 border-2 border-dashed border-primary/70 rounded-[3px]" />
      <div class="absolute left-0 bottom-0 w-[58px] h-[39px] rounded-[2px] shadow-[0_4px_10px_rgba(0,0,0,.25)] bg-[linear-gradient(180deg,#f3a76b_0%,#f7cf94_55%,#3c6e8f_56%,#173449_100%)]" />
      <svg class="absolute left-[50px] bottom-[31px] text-primary" width="76" height="52" viewBox="0 0 76 52" aria-hidden="true">
        <path d="M4 48 L68 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M54 6 L70 7 L64 21" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </div>
  </div>
</template>
