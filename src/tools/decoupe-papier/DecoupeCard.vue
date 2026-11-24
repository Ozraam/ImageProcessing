<!-- Vignette de la carte d'accueil : le tapis de coupe et un morceau de papier -->
<script setup lang="ts">
// Motif du tapis de coupe, partagé avec la page de l'outil (chargée à la demande)
import './decoupe.css'
</script>

<template>
  <div class="decoupe-mat grid place-items-center">
    <div class="w-[74px] h-[84px] bg-[#f6f6f1] rounded-[40%_46%_38%_44%] shadow-[6px_10px_14px_rgba(0,0,0,.35)] grid place-items-center">
      <svg width="50" height="56" viewBox="0 0 90 100" aria-hidden="true">
        <path d="M45 42 C47 60 40 76 45 98" stroke="#3f8a3a" stroke-width="4" fill="none" />
        <g fill="#ef6b5a">
          <ellipse v-for="a in [0, 72, 144, 216, 288]" :key="a" cx="45" cy="13" rx="7" ry="12" :transform="`rotate(${a} 45 30)`" />
        </g>
        <circle cx="45" cy="30" r="10" fill="#f4c430" />
      </svg>
    </div>
  </div>
</template>
