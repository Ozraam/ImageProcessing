<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="mx-auto max-w-[640px] px-4 py-20 text-center flex flex-col items-center gap-4">
    <h1 class="m-0 font-extrabold text-3xl">Page introuvable</h1>
    <p class="m-0 text-muted-foreground">Cet outil n'existe pas ou a changé d'adresse.</p>
    <Button as-child><RouterLink to="/">Retour à l'accueil</RouterLink></Button>
  </div>
</template>
