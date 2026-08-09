import { clerkMiddleware } from '@clerk/nuxt/server'
import type { H3Event } from 'h3'

const authenticate = clerkMiddleware()
type LocalMiddleware = (event: H3Event) => unknown

export default defineEventHandler((event) => {
  if (useRuntimeConfig(event).public.demoMode) return
  return (authenticate as unknown as LocalMiddleware)(event)
})
