// @ts-expect-error Nitro injects this virtual module when bundling the Cloudflare entry.
import '#nitro-internal-pollyfills'
import { useNitroApp } from 'nitropack/runtime'
// @ts-expect-error Nitro injects this typed-at-use virtual module for public asset routing.
import { isPublicAssetURL } from '#nitro-internal-virtual/public-assets'

type PagesEnv = Cloudflare.Env & {
  ASSETS?: Fetcher
}

declare global {
  // Nitro reads runtime bindings from this value in the Cloudflare preset.
  var __env__: Cloudflare.Env
}

const nitroApp = useNitroApp()
const socketPathPattern = /^\/api\/matches\/([^/]+)\/socket\/?$/
const methodHasBodyPattern = /post|put|patch/i

function matchIdFromSocketPath(pathname: string): string | null {
  const encodedMatchId = socketPathPattern.exec(pathname)?.[1]
  if (!encodedMatchId) return null
  try {
    return decodeURIComponent(encodedMatchId)
  } catch {
    return null
  }
}

function requestContext(request: Request, env: PagesEnv, context: ExecutionContext) {
  return {
    waitUntil: (promise: Promise<unknown>) => context.waitUntil(promise),
    _platform: {
      cf: request.cf,
      cloudflare: { request, env, context }
    }
  }
}

function authorizationHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  headers.delete('connection')
  headers.delete('upgrade')
  headers.delete('sec-websocket-extensions')
  headers.delete('sec-websocket-key')
  headers.delete('sec-websocket-protocol')
  headers.delete('sec-websocket-version')
  return headers
}

function viewerMemberId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('state' in payload)) return null
  const state = payload.state
  if (!state || typeof state !== 'object' || !('viewerMemberId' in state)) return null
  return typeof state.viewerMemberId === 'string' && state.viewerMemberId ? state.viewerMemberId : null
}

async function upgradeMatchSocket(
  request: Request,
  env: PagesEnv,
  context: ExecutionContext,
  url: URL,
  matchId: string
): Promise<Response> {
  const authorization = await nitroApp.localFetch(`/api/matches/${encodeURIComponent(matchId)}`, {
    context: requestContext(request, env, context),
    host: url.hostname,
    protocol: url.protocol,
    method: 'GET',
    headers: authorizationHeaders(request)
  })
  if (!authorization.ok) return authorization

  const memberId = viewerMemberId(await authorization.json())
  if (!memberId) {
    return Response.json({ error: 'The match authorization response was invalid.' }, { status: 502 })
  }

  return env.MATCH_ROOMS.getByName(matchId).fetch('https://match-room.internal/connect', {
    headers: {
      'Upgrade': 'websocket',
      'x-member-id': memberId
    }
  })
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)
    const matchId = matchIdFromSocketPath(url.pathname)
    if (matchId && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      globalThis.__env__ = env
      return upgradeMatchSocket(request, env, context, url, matchId)
    }

    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    let body: ArrayBuffer | undefined
    if (methodHasBodyPattern.test(request.method)) body = await request.arrayBuffer()
    globalThis.__env__ = env
    return nitroApp.localFetch(url.pathname + url.search, {
      context: requestContext(request, env, context),
      host: url.hostname,
      protocol: url.protocol,
      method: request.method,
      headers: request.headers,
      body
    })
  }
} satisfies ExportedHandler<PagesEnv>
