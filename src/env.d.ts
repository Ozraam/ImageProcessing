/// <reference types="vite/client" />
import 'vue-router'
import type { ToolDefinition } from '@/tools/types'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    tool?: ToolDefinition
  }
}
