<!-- Vignette de la carte d'accueil : une photo inclinée et son cadre de recadrage -->
<script setup lang="ts">
import './recadrer.css'
</script>

<template>
  <div class="recadrer-table grid place-items-center">
    <div class="relative w-[118px] h-[84px]">
      <div class="absolute inset-0 rotate-[-8deg] rounded-[3px] shadow-[0_6px_14px_rgba(0,0,0,.4)] bg-[linear-gradient(180deg,#9fc4ea_0%,#cfe2f3_55%,#6f9a5a_56%,#4f7a40_100%)]">
        <span class="absolute left-[22%] top-[24%] size-4 rounded-full bg-[#f6d36b]" />
      </div>
      <div class="absolute inset-[10px_14px] border-2 border-white rounded-[1px] shadow-[0_0_0_999px_rgba(20,24,40,.35)]">
        <span class="absolute inset-y-0 left-1/3 w-px bg-white/50" />
        <span class="absolute inset-y-0 left-2/3 w-px bg-white/50" />
        <span class="absolute inset-x-0 top-1/3 h-px bg-white/50" />
        <span class="absolute inset-x-0 top-2/3 h-px bg-white/50" />
      </div>
    </div>
  </div>
</template>
