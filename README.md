# Mind Boggling

An invite-only multiplayer game platform built with Nuxt 4 and Nuxt UI. The MVP ships Boggle; the game registry and authoritative room boundary are designed to support UNO and Farkle later.

## Architecture

- Nuxt Pages application: UI, Clerk authentication, D1-backed platform APIs, and the authenticated Durable Object gateway.
- One Cloudflare Durable Object per match: authoritative lobby, timers, submissions, scoring, presence, and WebSockets.
- Cloudflare D1: users, memberships, hashed match invites, finalized scores, and participant-only history.
- Clerk: dashboard-managed platform admission, authentication, friendly display names, passwords, and sessions.

KV is deliberately not used for live rooms: it is eventually consistent and cannot serialize concurrent match commands. Durable Objects provide the single-writer coordination and alarms a timed multiplayer game needs.

The detailed product and engineering plan is in [`docs/implementation-plan.md`](docs/implementation-plan.md).

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- A Clerk application
- A Cloudflare account with Pages, Workers, Durable Objects, and D1 access

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and replace every placeholder. Keep `NUXT_PUBLIC_DEMO_MODE=false` for real authentication. Demo mode bypasses the server session for local UI work, still requires the Clerk publishable key to initialize its UI SDK, and must never be enabled in production.

3. In the Clerk dashboard:

   - Disable public sign-up and invite approved friends and family from the dashboard.
   - Add `http://localhost:3000` and the deployed Pages origin to the application's allowed origins/redirect URLs.
   - Keep the sign-in route at `/sign-in`; unapproved visitors are sent to `/access-required`.

4. Create D1 and put the returned ID in both `wrangler.jsonc` files:

   ```bash
   pnpm exec wrangler d1 create mind-boggling
   ```

5. Apply the database migration locally:

   ```bash
   pnpm db:migrate:local
   ```

6. Run the Durable Object Worker and Nuxt app in separate terminals:

   ```bash
   pnpm room:dev
   pnpm dev
   ```

## Environment variables

`.env.example` is the source-of-truth checklist. The browser receives only variables prefixed with `NUXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK key |
| `NUXT_CLERK_SECRET_KEY` | Clerk Backend API key; server-only |
| `NUXT_PUBLIC_APP_URL` | Canonical origin used for match invite links |
| `NUXT_INVITE_COOKIE_SECRET` | At least 32 random bytes for signed invite-intent cookies |
| `NUXT_PUBLIC_DEMO_MODE` | Local-only fake identity switch; always `false` in production |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deployment account |
| `CLOUDFLARE_API_TOKEN` | Wrangler deployment token; never expose to Nuxt public runtime config |

Generate the cookie secret with `openssl rand -base64 32`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm room:typecheck
pnpm test
pnpm build
```

Run all checks with `pnpm check`.

## Cloudflare deployment

1. Confirm both [`wrangler.jsonc`](wrangler.jsonc) and [`workers/match-room/wrangler.jsonc`](workers/match-room/wrangler.jsonc) reference the same D1 database ID.
2. Apply D1 migrations to production:

   ```bash
   pnpm db:migrate:remote
   ```

3. Deploy the Durable Object Worker first so the Pages external binding has a target:

   ```bash
   pnpm room:deploy
   ```

4. Configure the `.env.example` values as Cloudflare Pages variables/secrets. The publishable key and public app URL must be available during the Pages build; the Clerk key, invite-cookie secret, account ID, and API token are secrets. Never commit their real values.
5. Build and deploy Pages:

   ```bash
   pnpm deploy
   ```

Cloudflare dashboard bindings must match the source configuration: D1 as `DB` and the external Durable Object namespace as `MATCH_ROOMS`, class `MatchRoom`, script `mind-boggling-match-room`.

## MVP rules

- Board size: 4×4, 5×5, or 6×6
- Round time: 3, 4, or 5 minutes
- Minimum word length: 2, 3, or 4 characters
- Match length: 1–5 rounds, default 3
- US English dictionary and Boggle scoring
- Versioned MIT-licensed `an-array-of-english-words` dictionary
- Words submitted by multiple players score zero for everyone
- During play, opponents see only word counts; words and scores are revealed after the round
- Match history is available only to participants
