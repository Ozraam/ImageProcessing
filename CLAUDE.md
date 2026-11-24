# CLAUDE.md

Atelier d'image : site Vue 3 qui rassemble des utilitaires de traitement d'image (le premier : Découpe papier).
Tout le traitement se fait dans le navigateur ; aucune image n'est envoyée à un serveur.

## Commandes

```bash
npm install
npm run dev        # serveur de développement Vite
npm run build      # vue-tsc -b (vérification des types) puis vite build → dist/
npm run preview    # sert dist/ (utile pour tester avec Playwright)
docker compose up -d --build   # production : node:22-alpine build → nginx:alpine, port 8090
```

Il n'y a pas de suite de tests : `npm run build` doit passer sans erreur, puis vérifier dans le navigateur
(Playwright est disponible) le parcours : importer/exemple → réglages → F5 → « Continuer avec ce résultat » → accueil.

## Pile

Vue 3 (`<script setup>`, TypeScript strict), Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`, pas de tailwind.config),
shadcn-vue (style new-york, Reka UI), vue-router (mode history), Pinia, idb-keyval, lucide-vue-next, vue-sonner.
Polices auto-hébergées via `@fontsource` : ne pas réintroduire Google Fonts (le site doit marcher hors ligne).

## Organisation

```
src/
  components/ui/      composants shadcn-vue (modifiables)
  components/shell/   AppHeader, CurrentImageChip, ImageDropzone, ToolCard
  components/tool/    gabarit commun : ToolLayout, ToolSection, ToolSlider, ToolStage, ToolExport
  composables/        useToolSettings (réglages par outil, sessionStorage), useImagePicker
  stores/image.ts     image en cours + images de la session
  tools/<id>/         un dossier par utilitaire, découvert automatiquement
  tools/registry.ts   import.meta.glob('./*/tool.ts') → accueil, menu, routes
  pages/              HomePage, NotFound
  styles/globals.css  tokens du thème, .tool-scope, utilitaire stage-checker
docs/PLAN.md          plan de migration et décisions validées
```

## Ajouter un utilitaire

Créer `src/tools/<id>/tool.ts` (`export default defineTool({...})`) et une page Vue qui utilise `<ToolLayout>`
avec les slots `#controls` (des `<ToolSection>`), `#export` (`<ToolExport>`), `#stage` (`<ToolStage>`), `#empty`.
Rien d'autre à modifier : la carte, le menu et la route `/outils/<id>` sont générés. Exemple complet dans le README.

- Réglages : `useToolSettings('<id>', defaults)` ; ils survivent à la navigation et au F5.
- Image : `useImageStore().current` (`blob`, `url`, `width`, `height`, `hasAlpha`). Un outil ne la modifie pas
  directement : `ToolExport` appelle `store.useResult(...)` quand l'utilisateur choisit « Continuer avec ce résultat ».
- Identité : `accent.light/dark` dans `tool.ts` remplace `--primary`/`--ring` dans toute la page (classe `.tool-scope`),
  donc les composants shadcn prennent la couleur de l'outil sans rien faire. Le motif d'aperçu passe par `class` sur
  `<ToolStage>` (le vert « tapis de coupe » est propre à la Découpe ; le thème global reste neutre).
- Calcul lourd : le faire dans un Web Worker, sur le modèle de `tools/decoupe-papier/`
  (`render.ts` pur et compatible OffscreenCanvas, `worker.ts`, `protocol.ts`, `renderer.ts` avec repli sur la page).

## Règles du produit (décidées avec l'utilisateur)

- L'image en cours est partagée entre toutes les pages et conservée après un F5 (IndexedDB), mais liée à l'onglet :
  un nouvel onglet démarre vide (identifiant dans sessionStorage). Ne pas casser ce comportement.
- Pas d'éléments destinés aux développeurs sur les pages (ex. pas de carte « Ajouter un outil »).
- N'afficher que des outils qui fonctionnent (pas de cartes « bientôt »).
- « Continuer avec ce résultat » remplace l'image en cours puis propose la liste des outils ou l'accueil,
  jamais un outil imposé.
- Téléchargement de l'image en cours disponible depuis l'accueil et l'en-tête.

## Conventions

- Tout le texte d'interface, les commentaires et les messages de commit sont en **français**.
- Composants shadcn : le registre shadcn-vue.com peut être bloqué par le réseau du conteneur. Dans ce cas, copier le
  dossier depuis `github.com/unovue/shadcn-vue` (`apps/v4/registry/new-york-v4/ui/<composant>`) vers
  `src/components/ui/`, puis remplacer les imports `"cn"` → `"@/lib/utils"`, `"@lucide/vue"` → `"lucide-vue-next"`,
  `@/registry/new-york-v4/ui/` → `@/components/ui/`.
- Alias `@/` → `src/`.

## Pièges rencontrés

- Un `watch(..., { immediate: true })` dans `<script setup>` s'exécute tout de suite : déclarer avant lui
  toutes les `ref` qu'il utilise (sinon « Cannot access … before initialization » en production).
- Ne jamais envoyer un objet réactif Vue au worker (`postMessage` ne clone pas les Proxy) : passer une copie
  (`{ ...params }`).
- `ToolStage` applique `class` à son cadre intérieur ; les styles `scoped` du parent ne l'atteignent pas, d'où le
  `<style>` non scopé avec un nom de classe préfixé par l'outil (ex. `.decoupe-mat`).
- nginx doit renvoyer `index.html` pour les routes `/outils/...` (`try_files` dans `nginx.conf`).
- Docker n'est pas disponible dans le conteneur de développement : l'image ne peut pas y être testée.
