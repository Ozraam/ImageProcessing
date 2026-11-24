# Atelier d'image

Utilitaires de traitement d'image réunis sur une même page, à commencer par **Découpe papier**
(un PNG détouré posé sur du papier froissé découpé aux ciseaux, avec son ombre).

Tout le traitement se fait dans le navigateur : aucune image n'est envoyée au serveur.
L'image importée est conservée d'une page à l'autre, et après un rafraîchissement, tant que l'onglet reste ouvert.

Pile : Vue 3, TypeScript, Vite, shadcn-vue (Reka UI + Tailwind CSS v4), vue-router, Pinia.

## Lancer avec Docker Compose

```bash
docker compose up -d --build
```

L'outil est ensuite accessible sur `http://<ip-du-serveur>:8090`.
Pour changer le port, modifiez la ligne `"8090:80"` dans `docker-compose.yml`.

L'image Docker construit l'application (`node:22-alpine`) puis la sert avec `nginx:alpine`.
Les deux existent en arm64 : elle fonctionne sur un Raspberry Pi 5. Les polices sont incluses dans le build,
l'outil n'a donc pas besoin d'Internet.

## Mettre à jour

```bash
git pull
docker compose up -d --build
```

## Développer

```bash
npm install
npm run dev        # serveur de développement
npm run build      # vérification des types + build dans dist/
```

## Ajouter un utilitaire

Un outil = un dossier dans `src/tools/`. Rien d'autre à modifier : la carte de l'accueil,
l'entrée du menu « Outils » et la route `/outils/<id>` apparaissent toutes seules.

1. `src/tools/mon-outil/tool.ts` déclare l'outil :

   ```ts
   import { Wand2 } from 'lucide-vue-next'
   import { defineTool } from '../types'

   export default defineTool({
     id: 'mon-outil',                                // → /outils/mon-outil
     name: 'Mon outil',
     description: 'Une phrase pour la carte et la page.',
     icon: Wand2,
     accent: { light: '#3346a8', dark: '#8d9cf0' },  // couleur propre à l'outil
     component: () => import('./MonOutil.vue'),
     // card: () => import('./MonOutilCard.vue'),   // vignette personnalisée (facultatif)
   })
   ```

2. `src/tools/mon-outil/MonOutil.vue` remplit le gabarit commun :

   ```vue
   <script setup lang="ts">
   import ToolLayout from '@/components/tool/ToolLayout.vue'
   import ToolSection from '@/components/tool/ToolSection.vue'
   import ToolSlider from '@/components/tool/ToolSlider.vue'
   import ToolStage from '@/components/tool/ToolStage.vue'
   import ToolExport from '@/components/tool/ToolExport.vue'
   import { useToolSettings } from '@/composables/useToolSettings'
   import { useImageStore } from '@/stores/image'
   import tool from './tool'

   const store = useImageStore()                                   // store.current : l'image en cours
   const settings = useToolSettings('mon-outil', { force: 50 })   // réglages retrouvés au retour
   async function renderFinal(): Promise<Blob> { /* … */ }
   </script>

   <template>
     <ToolLayout :tool="tool" :open-sections="['reglages']">
       <template #controls>
         <ToolSection value="reglages" title="Réglages">
           <ToolSlider v-model="settings.force" label="Force" />
         </ToolSection>
       </template>
       <template #export>
         <ToolExport :tool="tool" filename="resultat.png" :render="renderFinal" />
       </template>
       <template #stage>
         <ToolStage class="stage-checker"> … aperçu … </ToolStage>
       </template>
     </ToolLayout>
   </template>
   ```

Ce que le gabarit apporte à chaque outil : l'en-tête, le panneau de réglages en sections repliables,
la zone de dépôt quand aucune image n'est chargée, la barre d'export (« Télécharger » et
« Continuer avec ce résultat », qui fait du résultat l'image en cours puis propose les autres outils).
Ce qui reste propre à l'outil : sa couleur d'accent (appliquée à tous les boutons, curseurs et
interrupteurs de sa page), le motif de sa zone d'aperçu et ses interactions.

Les composants d'interface viennent de shadcn-vue et sont dans `src/components/ui/` ; on peut les modifier.
Pour en ajouter un : `npx shadcn-vue@latest add <composant>` (le fichier `components.json` est prêt).

## Organisation

```
src/
  components/ui/      composants shadcn-vue
  components/shell/   en-tête, image en cours, zone de dépôt, carte d'outil
  components/tool/    gabarit commun des outils
  stores/image.ts     image en cours (mémoire + IndexedDB, liée à l'onglet)
  tools/              un dossier par utilitaire, découvert automatiquement
  pages/              accueil, page introuvable
```
