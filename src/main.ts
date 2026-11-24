import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { usePreferredDark } from '@vueuse/core'
import { watchEffect } from 'vue'
import App from './App.vue'
import { router } from './router'
import { useImageStore } from './stores/image'
import './styles/globals.css'
import 'vue-sonner/style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router)

// Thème clair/sombre selon le système
const dark = usePreferredDark()
watchEffect(() => document.documentElement.classList.toggle('dark', dark.value))

// Récupère l'image de l'onglet (après un F5) avant d'afficher les pages
useImageStore(pinia).restore().finally(() => app.mount('#app'))
