/// <reference types="@cloudflare/workers-types" />

import type { H3Event } from 'h3'

interface AppBindings {
  DB: D1Database
  MATCH_ROOMS: DurableObjectNamespace
  NUXT_CLERK_SECRET_KEY?: string
  NUXT_INVITE_COOKIE_SECRET?: string
}

interface CloudflareContext {
  env?: Partial<AppBindings>
}

export function getBindings(event: H3Event): AppBindings {
  const cloudflare = event.context.cloudflare as CloudflareContext | undefined
  if (!cloudflare?.env?.DB || !cloudflare.env.MATCH_ROOMS) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Cloudflare bindings are unavailable. Run through Wrangler or configure the Pages bindings.'
    })
  }
  return {
    DB: cloudflare.env.DB,
    MATCH_ROOMS: cloudflare.env.MATCH_ROOMS
  }
}

export function getRoom(event: H3Event, matchId: string): DurableObjectStub {
  return getBindings(event).MATCH_ROOMS.getByName(matchId)
}

export function getRuntimeSecret(event: H3Event, name: 'NUXT_CLERK_SECRET_KEY' | 'NUXT_INVITE_COOKIE_SECRET'): string {
  const cloudflare = event.context.cloudflare as CloudflareContext | undefined
  const value = cloudflare?.env?.[name]
  return typeof value === 'string' ? value : ''
}
