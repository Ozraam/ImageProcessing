import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { tools, toolPath } from '@/tools/registry'
import HomePage from '@/pages/HomePage.vue'

const toolRoutes: RouteRecordRaw[] = tools.map(tool => ({
  path: toolPath(tool),
  name: `tool-${tool.id}`,
  component: tool.component,
  meta: { tool, title: tool.name },
}))

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage, meta: { title: 'Accueil' } },
    ...toolRoutes,
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFound.vue'), meta: { title: 'Page introuvable' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach(to => {
  document.title = `${to.meta.title ?? ''} · Atelier d'image`
})
