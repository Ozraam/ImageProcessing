# Plan — Migration vers Vue 3 + shadcn-vue

> Statut : **validé et mis en œuvre** (étapes 1 à 6, et le Web Worker de la phase 2).
> Mockups modifiables : https://claude.ai/artifact/VAv4o6VWThBVj5KmiWw2m3

## 1. Objectifs

1. Passer de la page unique `index.html` (HTML + JS natif) à une application **Vue 3** qui utilise **shadcn-vue**.
2. Une **page d'accueil** qui rassemble tous les utilitaires de traitement d'image (le premier : *Découpe papier*).
3. **Ajouter un utilitaire doit être simple** : un dossier, un fichier de déclaration, et l'outil apparaît dans l'accueil, le menu et le routeur.
4. Un **style global commun** (en-tête, panneau de réglages, zone d'aperçu, export) mais une **identité propre à chaque outil** (couleur d'accent, motif de la zone d'aperçu, icône).
5. **L'image en cours est conservée entre les pages** tant que l'utilisateur reste sur le site : on la charge une fois, on passe d'un outil à l'autre sans la réimporter, et on peut envoyer le résultat d'un outil vers un autre.
6. Le traitement reste **100 % dans le navigateur** (aucune image envoyée au serveur) et le déploiement **Docker + nginx** reste identique pour l'utilisateur (`docker compose up -d --build`).

## 2. Pile technique

| Besoin | Choix | Pourquoi |
|---|---|---|
| Framework | Vue 3 + `<script setup>` + TypeScript | demandé ; TS rend le contrat d'un outil explicite |
| Build | Vite | standard Vue, build statique servi par nginx |
| UI | shadcn-vue (Reka UI + Tailwind CSS v4) | demandé ; composants copiés dans le projet, donc modifiables |
| Routage | vue-router (mode history) | une URL par outil : `/`, `/outils/decoupe-papier` |
| État partagé | Pinia | store de l'image en cours, visible depuis toutes les pages |
| Icônes | lucide-vue-next | icônes par défaut de shadcn |
| Calcul lourd | Web Worker (phase 2) | le rendu de la découpe bloque l'UI sur les grandes images |

## 3. Arborescence cible

```
src/
  main.ts                    # app, router, pinia
  App.vue                    # AppShell : en-tête + <RouterView>
  router.ts                  # routes générées depuis le registre d'outils
  styles/
    globals.css              # tokens Tailwind/shadcn + thème « atelier » (clair/sombre)
  components/
    ui/                      # composants shadcn-vue (button, card, slider, select, accordion, tooltip, sonner…)
    shell/
      AppHeader.vue          # logo, menu Outils, puce « Image en cours »
      CurrentImageChip.vue   # miniature + nom + Changer / Retirer
      ImageDropzone.vue      # import (clic, glisser-déposer, coller)
    tool/
      ToolLayout.vue         # gabarit commun d'une page outil
      ToolControls.vue       # panneau de réglages (slots par section)
      ToolStage.vue          # zone d'aperçu (motif fourni par l'outil)
      ToolExport.vue         # taille d'export, télécharger, « Continuer avec ce résultat »
      ToolCard.vue           # carte d'un outil sur l'accueil
  stores/
    image.ts                 # image en cours (voir §5)
  tools/
    registry.ts              # découverte automatique des outils
    types.ts                 # type ToolDefinition
    decoupe-papier/
      tool.ts                # déclaration (nom, icône, accent, motif…)
      DecoupePapier.vue      # page de l'outil (utilise ToolLayout)
      render.ts              # algorithme actuel extrait de index.html (pur, sans DOM d'UI)
      worker.ts              # (phase 2) rendu hors du thread principal
  pages/
    HomePage.vue             # accueil : image en cours + grille d'outils
    NotFound.vue
```

## 4. Ajouter un utilitaire

Un outil = **un dossier dans `src/tools/`**, rien d'autre à modifier.

```ts
// src/tools/detourage/tool.ts
import { Scissors } from 'lucide-vue-next'
import { defineTool } from '../types'

export default defineTool({
  id: 'detourage',                       // → route /outils/detourage
  name: 'Détourage',
  description: "Supprime l'arrière-plan pour obtenir un PNG transparent.",
  icon: Scissors,
  accent: { light: '#3346a8', dark: '#8d9cf0' },  // couleur propre à l'outil
  stage: 'checker',                      // motif d'aperçu : 'mat' | 'checker' | 'plain' | composant Vue
  accepts: ['image/*'],
  status: 'beta',                        // 'stable' | 'beta' | 'bientot'
  component: () => import('./Detourage.vue'),
})
```

```ts
// src/tools/registry.ts
const modules = import.meta.glob<{ default: ToolDefinition }>('./*/tool.ts', { eager: true })
export const tools = Object.values(modules).map(m => m.default).sort(byOrder)
```

Le routeur et l'accueil lisent `tools` : la carte, l'entrée du menu et la route apparaissent seules.

La page de l'outil n'écrit que **ses réglages et son rendu** ; tout le reste vient du gabarit :

```vue
<!-- src/tools/detourage/Detourage.vue -->
<ToolLayout :tool="tool" :busy="busy" :result="result">
  <template #controls>
    <ToolSection title="Sujet"> … sliders shadcn … </ToolSection>
  </template>
  <template #stage-overlay> … curseur avant/après … </template>
</ToolLayout>
```

### Style global vs identité de l'outil

- **Commun (imposé par le gabarit)** : en-tête, typographie (Bricolage Grotesque pour les titres, IBM Plex Sans/Mono pour le texte et les valeurs), panneau de réglages à gauche en sections repliables, aperçu à droite, barre d'export, toasts, thème clair/sombre.
- **Propre à chaque outil** : `accent` (injecté en variable CSS `--tool-accent`, utilisée par les boutons principaux, sliders, focus et l'icône), `stage` (motif de l'aperçu : tapis de coupe vert pour la découpe, damier pour le détourage…), icône, et un slot `#stage-overlay` pour une interaction spécifique (cadre de recadrage, curseur avant/après…).
- Un générateur facultatif `npm run new-tool <id>` crée le dossier à partir d'un modèle.

## 5. Image conservée entre les pages

Store Pinia `useImageStore` :

```ts
state: {
  source: { blob, url, name, width, height, hasAlpha } | null,  // image importée
  history: Array<{ toolId, blob, url, at }>,                    // résultats produits par les outils
}
actions: setSource(file), useResultAsSource(entry), clear()
```

- Importée une fois (accueil, puce d'en-tête ou n'importe quel outil), l'image est **visible dans toutes les pages** ; chaque outil la reçoit à l'ouverture.
- Comme l'app est une SPA, l'image reste en mémoire tant qu'on navigue dans le site.
- **Rechargement de page (F5)** : l'image est aussi copiée dans IndexedDB (`sessionStorage` est limité à ~5 Mo, trop petit pour un PNG). Elle est effacée à la fermeture de l'onglet grâce à un identifiant de session gardé dans `sessionStorage`. → *à valider : voulez-vous survivre au F5, ou la mémoire seule suffit-elle ?*
- **Chaîner les outils** : le bouton « Continuer avec ce résultat » de la barre d'export remplace l'image en cours par le résultat, puis propose la liste des autres outils ou le retour à l'accueil (jamais un outil imposé).
- Les réglages de chaque outil sont aussi gardés dans le store (par outil), pour retrouver ses curseurs en revenant.
- Les `ObjectURL` sont libérés (`URL.revokeObjectURL`) quand l'image est remplacée.

## 6. Étapes

1. **Socle** : Vite + Vue 3 + TS, Tailwind v4, `npx shadcn-vue init`, thème « atelier » repris des couleurs actuelles, router, Pinia, `AppHeader`.
2. **Gabarit outil** : `ToolLayout`, `ToolControls`, `ToolStage` (motifs `mat` / `checker` / `plain`), `ToolExport`.
3. **Store image** + `ImageDropzone` + `CurrentImageChip` (mémoire, puis IndexedDB si validé).
4. **Migration Découpe papier** : extraire l'algorithme (`render.ts`) tel quel, reconstruire les réglages avec les composants shadcn, reprendre le recadrage dans `#stage-overlay`, conserver l'exemple de fleur.
5. **Accueil** : grille d'outils générée depuis le registre, image en cours, dépôt.
6. **Docker** : Dockerfile multi-étapes (`node:22-alpine` pour `npm run build` → `nginx:alpine`), `nginx.conf` avec `try_files $uri /index.html` pour les routes. Toujours compatible arm64 (Raspberry Pi 5).
7. **Phase 2** : Web Worker pour le rendu, modèle `new-tool`, deuxième outil réel (détourage, redimensionnement…).

## 7. Décisions

1. L'image survit au F5 : copie dans IndexedDB, liée à l'onglet (effacée à la fermeture).
2. Seul l'outil réel (Découpe papier) est affiché ; les autres outils seront ajoutés quand ils existeront.
3. Polices auto-hébergées (paquets `@fontsource`), aucun appel à Google Fonts.
4. Global neutre ; le vert « tapis de coupe » est propre à la Découpe papier.
5. Pas de carte « Ajouter un outil » sur l'accueil (documentation développeur uniquement, dans le README).
6. « Continuer avec ce résultat » remplace l'image en cours puis propose la liste des outils ou l'accueil.
7. Bouton « Télécharger l'image en cours » sur l'accueil et dans l'en-tête.
