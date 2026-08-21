# Mind Boggling — Multiplayer Game Platform Implementation Plan

## 1. Product goal

Build a private, online multiplayer game platform in Nuxt 4 and Nuxt UI, with Boggle as its MVP game. A host chooses a game, creates a private match, shares unguessable invite links, waits for invited players in a lobby, and starts synchronized play. The platform owns identity, invitations, rooms, presence, reconnection, real-time delivery, match lifecycle, and scoreboard presentation. Each game module owns its rules, state transitions, commands, validation, and game-specific interface. UNO and Farkle are planned v2 games and are explicitly outside the MVP.

The architecture must make a second game an additive feature: a new module, manifest, migrations where needed, and game UI—not a rewrite of the lobby, invitation, networking, or session systems.

### MVP success criteria

- A host can choose Boggle and create a private match without exposing it in a public directory.
- Only users admitted to the platform through Clerk invitations can authenticate and access the game catalog.
- Any authenticated platform user can redeem a valid match invite link, join once, and later rejoin from their Clerk session.
- Two to eight players can enter a lobby, mark themselves ready, and play the same timed board.
- The Boggle module checks word paths against adjacency rules and a server-side dictionary.
- Round results are deterministic, persisted, and visible to every player on a scoreboard.
- Refreshing or briefly disconnecting does not lose membership, submitted words, or the authoritative timer.
- The primary flows work on modern desktop browsers with keyboard and screen-reader support. Mobile optimization is desirable but is not an MVP release requirement.
- Players can revisit a match-history scoreboard showing past placements and per-match totals.
- Users can manage a friendly platform display name and their password through Clerk-backed account controls.
- All MVP interface copy, dates, validation messages, and the Boggle dictionary use US English (`en-US`).
- A minimal test game can run through the same create, invite, lobby, play, and results lifecycle to prove the platform boundary before a real second game is built.

## 2. Product rules to lock before implementation

The following are proposed MVP defaults. Keep them configurable at the game level so the rules can evolve without a data migration.

| Rule | MVP default |
| --- | --- |
| Board size | Host chooses 4 × 4, 5 × 5, or 6 × 6; default 4 × 4 |
| Round length | Host chooses 3, 4, or 5 minutes; default 3 minutes |
| Players | 2–8 |
| Minimum valid word | Host chooses 2, 3, or 4 characters; default 3 |
| Adjacency | Eight neighboring tiles; a tile may be used once per word |
| Multi-letter tiles | Ordered pairs such as `Qu`, `Th`, and `Ph` contribute two letters |
| Scoring | 3–4 letters: 1; 5: 2; 6: 3; 7: 5; 8+: 11 |
| Duplicate words | A word found by more than one player scores zero for everyone |
| Match length | Host chooses 1–5 rounds; default 3; winner has the highest cumulative score |
| Host powers | Start round, continue to next round, end game, remove a player |

Open product decisions are limited to whether spectators will be supported later and the final retention duration for detailed word-level results. The MVP uses Clerk accounts for durable identity, retains participant-only match-summary history, shows only opponents' word counts during play, and reveals words and final scores only after the round.

### Language and localization

- Ship the MVP in US English only and set the document language to `en-US`.
- Keep user-facing copy in locale message files rather than embedding prose throughout components and services.
- Use `Intl` APIs for dates, times, lists, numbers, ordinals, and plural-sensitive output; do not store formatted display strings in the database.
- Store stable machine codes for validation and command errors, then translate them at the UI boundary.
- Version game dictionaries by locale. Boggle MVP matches use an approved `en-US` dictionary; a future locale may select a different dictionary and normalization policy without changing the platform runtime.
- Include locale in the game definition/manifest compatibility contract, but expose only `en-US` until another language is complete and tested.
- Configure Clerk's UI localization to US English for the MVP and keep its locale selection aligned with the application locale later.
- Design layouts for text expansion and avoid composing sentences from fragments, even though only one locale ships initially.

## 3. Technical architecture

### Architectural boundaries

Organize the system as a modular monolith first. The boundaries are explicit TypeScript packages/modules but deploy together until scale or team ownership justifies separate services.

1. **Platform core:** game catalog, private matches, invitations, memberships, roles, sessions, presence, host controls, lifecycle, reconnection, event ordering, and audit events.
2. **Game runtime:** loads a registered game definition, validates commands, advances authoritative state, persists events/snapshots, and emits participant-specific projections.
3. **Game modules:** Boggle first; later games implement the same runtime contracts and may add their own tables, services, and UI.
4. **Shared experience:** app shell, create/join flows, lobby, invite management, connectivity, generic scoreboard primitives, errors, and accessibility conventions.
5. **Game experience:** board/table/canvas, game controls, game-specific status, score breakdown, and rules help.

Do not split these into networked microservices for the MVP. Enforce boundaries through imports, contracts, and tests; keep deployment and local development simple.

### Application

- **Nuxt 4** for pages, middleware, composables, server routes, SSR, and deployment through Nitro.
- **Nuxt UI v4** for accessible controls and overlays, wrapped by `UApp` in `app/app.vue`.
- **Clerk's official Nuxt SDK (`@clerk/nuxt`)** for invitation-gated platform access, sign-up, sign-in, session lifecycle, and authenticated server context.
- **TypeScript** contracts shared between browser and server from `shared/`.
- **Cloudflare Pages** for the Nuxt application, SSR/Pages Functions, preview deployments, and static assets.
- **Cloudflare D1** for relational platform data, invitations, memberships, finalized scores, and match history.
- **A separate Cloudflare Durable Object Worker** for authoritative active-match coordination and WebSockets; Cloudflare Pages binds to its namespace.
- **Nitro server routes / Pages Functions** for match creation, invite redemption, authenticated snapshots, and commands.
- **Durable Object WebSocket gateway** for room events, presence, ready state, game events, clock synchronization, and score publication.
- **Game registry** shared by the server and app build, keyed by a stable identifier such as `boggle.v1`.

### Game module contract

Define the narrowest useful contract in `shared/games/contract.ts`. Exact generics may change during implementation, but the responsibilities should not:

```ts
interface GameDefinition<Settings, State, Command, Event, PlayerView, Score> {
  manifest: GameManifest
  settingsSchema: StandardSchemaV1<Settings>
  commandSchema: StandardSchemaV1<Command>
  createInitialState(input: CreateGameInput<Settings>): State
  decide(context: CommandContext<State, Command>): Event[]
  evolve(state: State, event: Event): State
  project(state: State, viewer: ViewerContext): PlayerView
  getScoreboard(state: State): ScoreboardProjection<Score>
}
```

- `manifest` declares the stable key, version, name, player range, capabilities, settings UI, and compatible client version.
- `decide` is authoritative and rejects illegal commands; `evolve` is deterministic and side-effect free.
- `project` prevents hidden information from leaking to a player or spectator.
- Optional capabilities describe concepts such as rounds, teams, spectators, simultaneous play, turn timers, rematches, and cumulative scoring. The platform must not assume every game has rounds or a square board.
- The browser uses a separate UI registry that maps the manifest key to lazy-loaded Nuxt components. Server domain modules never import Vue components.
- Version game definitions. An in-progress or historical match remains bound to the definition version with which it was created.

### Persistence and coordination

- **D1 is the relational system of record** for players, catalog entries, matches, memberships, invite digests/intents, finalized score projections, and durable match-summary history.
- **One Durable Object per match** is the serialization and real-time coordination atom. Resolve it deterministically from the match ID; never route every match through one global object.
- The match Durable Object owns active game state, ordered in-progress events, connection attachments, presence, and the current alarm. Its SQLite-backed storage persists active state across eviction/restart.
- Use Cloudflare's WebSocket Hibernation API so an idle room can sleep without dropping connected players. Persist per-connection identity/membership references in WebSocket attachments and persist all important match state before broadcasting it.
- Use one Durable Object alarm for the next authoritative deadline, such as countdown completion or round end. Alarm handling is idempotent because delivery is at least once and scheduling a new alarm replaces the existing one.
- Finalization writes an idempotent result projection to D1. Because Durable Object storage and D1 do not share a cross-product transaction, persist a finalization outbox record in the Durable Object first, retry the D1 write, and mark it delivered only after D1 acknowledges the idempotency key.
- Presence and transient connection state remain in the match Durable Object rather than D1. Rate limiting may use per-match Durable Object state and Cloudflare platform controls; no Redis dependency is required.
- The Durable Object Worker is deployed separately because a Pages project can bind to a Durable Object namespace but cannot define/deploy the Durable Object class itself.
- Platform and game logic live behind services that do not depend on Nitro handlers, so HTTP, WebSocket, tests, and future background jobs use the same rules.
- Use an ordered event stream plus periodic state snapshots in Durable Object SQLite for active game state. This supports reconnect/replay and varied game shapes without forcing every future game into Boggle tables. Game modules may add normalized D1 tables for history, search, moderation, or analytics.

### Cloudflare Pages deployment boundary

- Build the existing Nuxt project with Cloudflare's current Nuxt Pages adapter/preset and keep the generated Pages output in the configured build directory.
- Use `nitro-cloudflare-dev` and Wrangler bindings for local development; generate binding types with `wrangler types` rather than hand-writing environment interfaces.
- Configure D1 and Durable Object bindings for preview and production environments. Remote Pages bindings must be configured explicitly; local Wrangler configuration alone does not create deployed bindings.
- Pages Functions authenticate Clerk sessions and authorize platform/match access before forwarding trusted internal requests or WebSocket upgrades to the match Durable Object binding.
- Keep the Durable Object Worker unreachable as an unauthenticated public game API where possible; invoke it through the Pages binding/service boundary.
- Store Clerk and other secrets through Cloudflare secret/environment configuration, never in `wrangler.jsonc`, source, or Pages build variables exposed to the browser.

### Authentication and match authorization

Clerk and the platform have separate responsibilities:

- **Clerk admits and authenticates the person:** platform invitations, sign-up, sign-in, account recovery, session cookies/tokens, and the stable Clerk user ID.
- **The platform authorizes match access:** invites, membership, host/player/spectator roles, removals, and game commands.

Do not create one Clerk Organization per match. A private match is short-lived application data, not an identity tenant.

Recommended flow:

1. A platform administrator sends Clerk invitations from the Clerk dashboard to the people allowed to create accounts and access the application. The MVP has no application-owned administration screen, and public self-service sign-up remains disabled unless product policy changes.
2. An authenticated host creates a match for a registered game. `event.context.auth()` supplies the verified Clerk user ID; the server creates the host membership.
3. The host creates a high-entropy match invite link; only its token digest is stored. The link is reusable by different approved platform users until the host revokes it or the match starts, subject to the match player limit. Each Clerk user can create only one active membership in that match.
4. When a match invite URL is opened, the server validates it and exchanges it for a short-lived, opaque invite-intent cookie before removing the raw token from the browser URL.
5. An unauthenticated visitor signs in with Clerk and returns to the invite flow. A person without an approved Clerk account sees a clear platform-access message rather than being allowed to self-register. Redirect state contains only the opaque intent ID, never the raw match token.
6. The server verifies the Clerk session again, consumes or records use of the invite transactionally, and creates a `MatchMember` linked to the Clerk user ID.
7. Every HTTP command and WebSocket handshake must satisfy both checks: a valid Clerk session and an active membership for the requested match.

Store the user's friendly `displayName` in Clerk `publicMetadata` through an authenticated server endpoint that calls Clerk's Backend API. Validate length, Unicode normalization, reserved words, and moderation rules before updating Clerk. This name does not need to be globally unique. After a successful update, reload the Clerk user resource and refresh the local read model.

Create a small D1 `Player` record keyed by Clerk user ID for platform-owned preferences and a synchronized display-name snapshot. Clerk remains the source of truth for authentication and the current display name; `MatchMember` captures a historical display-name snapshot so old scoreboards remain readable after a rename. Use signed Clerk webhooks only for lifecycle events the product actually needs, such as refreshing a profile or anonymizing a deleted account. Never copy authentication secrets or unnecessary profile data into D1.

Password changes remain entirely in Clerk. Mount Clerk's `UserProfile` account-management component, or call the Clerk User object's `updatePassword()` method if a custom Nuxt UI form is required. The application must never receive, log, persist, or proxy plaintext passwords through its own API.

## 4. Domain model

| Entity | Key fields and responsibilities |
| --- | --- |
| `GameCatalogEntry` | Stable game key/version, availability, manifest metadata, minimum client version |
| `Player` | Clerk user ID, platform display name/avatar reference if used, preferences, created/updated timestamps, deletion/anonymization status |
| `Match` | ID, game key/version, host membership ID, lifecycle status, settings JSON, event sequence, created/ended timestamps |
| `MatchMember` | Match ID, Clerk user ID, display-name snapshot, role, ready state, joined/removed timestamps |
| `Invite` | Match ID, token digest, created by, max uses, use count, expiry, revoked timestamp |
| `MatchEvent` | Match ID, monotonic sequence, game event type/version, payload JSON, actor, occurred timestamp |
| `MatchSnapshot` | Match ID, last event sequence, game state version, state JSON, created timestamp |
| `ScoreProjection` | Match ID, scope/segment, member or team ID, score payload, rank, finalized timestamp |
| `PlayerMatchSummary` | Player ID, match/game identifiers, placement, score summary, completed timestamp; durable read model for match history |
| `BoggleRound` | Boggle-owned read model for round number, board seed/tiles, starts/ends/finalized timestamps |
| `BoggleWordSubmission` | Boggle-owned submission record: round, member, word, tile path, validity, rejection reason |

The first seven entities are D1 tables/read models. Active `MatchEvent` and `MatchSnapshot` records live in Durable Object SQLite while a match is running, then compact finalized projections move to D1. Use D1 and Durable Object SQLite constraints for one active membership per Clerk user per match, per-match event sequence, snapshot uniqueness, Boggle round numbering, submission uniqueness per player/round/word, and idempotent score finalization. Platform migrations own generic D1/DO tables; each game module owns migrations for its optional read models.

## 5. Authoritative match state and real-time protocol

The browser is an input and rendering client; it never decides whether a move, word, transition, or score is valid.

### Platform lifecycle

```text
created → lobby → active → finished → archived
              ↘ cancelled
```

- The platform lifecycle stays intentionally generic. Boggle owns its nested `countdown → playing → scoring → round-results` state and later games may use turns, phases, hands, or continuous play.
- Only allowed platform and game transitions are accepted, and every transition is transactional.
- Timed games store absolute server timestamps. Clients derive countdowns from server time and periodically correct drift.
- The single match Durable Object serializes command evaluation and finalization, removing the need for a distributed Redis lock.
- Rejoining clients request a state snapshot, then resume events after the snapshot sequence number.

### Event envelope

Every WebSocket event should include:

```ts
interface RealtimeEvent<T> {
  version: 1
  matchId: string
  gameKey: string
  sequence: number
  occurredAt: string
  type: string
  payload: T
}
```

Initial event set:

- Platform commands: `presence.join`, `member.ready`, `match.start`, `match.end`, and host moderation commands.
- Game commands use a namespaced type and validated payload, for example `boggle.word.submit` and `boggle.round.continue`.
- Server events: `state.snapshot`, `presence.changed`, `member.updated`, `game.event`, `scoreboard.updated`, `match.finished`, and `error`.
- Commands carry an idempotency key. The server acknowledges or rejects them with a stable machine-readable reason.

## 6. Word validation and scoring

Create the first pure game module under `games/boggle/server/`:

- Deterministically generate a board from a cryptographically random seed and the selected dice set.
- Select the appropriate approved dice/letter distribution for 4 × 4, 5 × 5, and 6 × 6 boards; persist the board-size and distribution version with the round.
- Normalize input consistently: Unicode normalization, lowercase, trim, and locale policy.
- Confirm the supplied tile path spells the normalized word, follows adjacency, and does not reuse a tile.
- Confirm the word exists in the approved dictionary and is not excluded by the product's proper-noun/abbreviation policy.
- Enforce the match's configured minimum word length of 2, 3, or 4 normalized characters.
- Accept submissions only while the authoritative round is active.
- Finalize a round transactionally: group duplicate words, assign zero where required, calculate per-player totals, persist ranks, and emit one finalized result.

The MVP uses the normal-word and American-English tiers from `wordlist-english@1.2.1`, which are derived from SCOWL and exclude SCOWL's proper-name and abbreviation categories. Its stable version identifier is stored with each generated board so future dictionary updates do not make historical results ambiguous. Nothing in the platform core imports dictionary or board code.

## 7. Routes and user flows

| Route | Purpose |
| --- | --- |
| `/` | Choose an available game and create a private match; no public match browser |
| `/sign-in`, `/sign-up` | Clerk authentication surfaces with safe post-auth redirect handling |
| `/account/[...account]` | Clerk-backed account management: friendly display name, password/security, active sessions, and profile details |
| `/invite/[token]` | Validate invite, establish opaque invite intent, remove token from URL, authenticate if needed, redeem, and redirect |
| `/matches/[matchId]` | Shared responsive room shell that renders lobby, the registered game UI, results, or finished state |
| `/history` | Authenticated player's completed matches, placements, scores, and links to retained result details |

Use route middleware to require the match-scoped session before loading a room. Do not put invite tokens in analytics, error payloads, canonical URLs, or post-redemption browser history; replace the URL after redemption.

### Core screens/states

1. **Create game:** authenticated game catalog, recent-match summary, privacy explanation, and a Boggle setup form for board size (4 × 4 / 5 × 5 / 6 × 6), round time (3 / 4 / 5 minutes), minimum valid word length (2 / 3 / 4 characters), and round count (1–5).
2. **Join by invite:** invited game context, Clerk sign-in handoff when needed, friendly display-name confirmation with an account-edit link, plus expired/revoked/already-used and platform-access-required states.
3. **Lobby:** participant roster, presence, ready status, invite controls for the host, and start eligibility.
4. **Active round:** board as the dominant control, timer, word input/history, connection state, and opponents' word counts only. Opponent words and all final scores remain hidden until the round ends.
5. **Round results:** ranked totals, unique/duplicate/invalid words, personal breakdown, and host-only next-round action.
6. **Final scoreboard:** cumulative ranking, round-by-round points, winner treatment, and rematch/leave actions.
7. **Match history:** participant-only, filterable recent matches with game type, date, participants, placement, score, and retained results. Nonparticipants cannot enumerate or open the history record.
8. **Account:** editable friendly display name plus Clerk-managed password/security controls.
9. **Recovery states:** reconnecting, kicked, host disconnected, game ended, server unavailable, and stale client version.

## 8. Nuxt project structure

```text
app/
  components/
    match/           # Shared room shell, connection status, host controls
    lobby/           # Roster, ready control, invite panel
    scoreboard/      # Generic ranking primitives and capability-aware layouts
  composables/       # useMatchRoom, useRealtime, useServerClock
  middleware/        # Clerk authentication and match-membership route guards
  pages/
    index.vue
    sign-in.vue
    sign-up.vue
    account/[...account].vue
    invite/[token].vue
    matches/[matchId].vue
    history.vue
  types/             # UI-only types
  i18n/              # en-US messages now; future locale bundles later
games/
  registry.ts        # Build-safe manifest and lazy UI mappings
  contract.ts        # Game definition and capability contracts
  boggle/
    manifest.ts
    shared/          # Commands, events, views, validation schemas
    server/          # Engine, dictionary, services, projections
    app/             # Board, timer, word list, results components/composables
    migrations/      # Optional Boggle-owned read models
server/
  api/               # Pages Functions: match creation, invites, history, auth gateway
  middleware/         # Clerk server middleware / authenticated API boundary
  routes/             # Authenticated WebSocket upgrade proxy to Durable Objects
  platform/           # Catalog, match, invite, membership, D1 services
  repositories/       # D1 prepared queries and idempotent projections
  services/           # Pages-side orchestration and game registry adapter
  utils/              # Sessions, permissions, rate limiting, event publishing
workers/
  match-runtime/
    src/MatchRoom.ts  # One SQLite-backed Durable Object per match
    src/index.ts      # Binding/RPC entrypoint; no public untrusted game logic
    migrations/       # Durable Object class and SQLite schema migrations
    wrangler.jsonc    # DO namespace, migrations, bindings, observability
shared/
  types/              # Platform API and real-time contracts
  validation/         # Shared schemas for safe client/server parsing
tests/
  unit/
  integration/
  e2e/
```

Keep page components thin. Nuxt composables own client orchestration; platform services own authorization and generic lifecycle; the selected game definition owns game transitions. Enforce import rules so platform core cannot depend on Boggle and one game module cannot depend on another.

## 9. Nuxt UI component strategy

- `UApp` remains the root wrapper for overlays, tooltips, and toasts.
- Use `UForm`, `UFormField`, and `UInput` for create/join forms with schema validation.
- Use `UButton`, `UBadge`, `UAvatar`, `UTooltip`, `UModal`/`UDrawer`, `UTable`, `UProgress`, and `UAlert` where their semantics fit.
- Implement the Boggle letter board as a dedicated accessible game component rather than forcing a generic grid component to behave like a game surface.
- Define semantic colors and component variants centrally in `app/app.config.ts`; keep design tokens in `app/assets/css/main.css`.
- Use Nuxt UI responsive patterns and avoid making gameplay depend on hover. The required accessibility zoom target applies to the supported desktop viewport; 320 CSS-pixel mobile gameplay is a stretch target.

## 10. Security, privacy, and fairness

- Hash invite tokens at rest; Clerk owns session-token storage and rotation.
- Verify Clerk authentication on protected API handlers and WebSocket connections; client route middleware is a navigation affordance, not the security boundary.
- Authorize every HTTP command and WebSocket message against active match membership and role after authentication succeeds.
- Rate-limit invite redemption, match creation, WebSocket connection attempts, and word submissions.
- Validate all payloads at the boundary; cap display-name and word lengths.
- Escape user-provided names and never render them as HTML.
- Do not send the next board or seed before the round starts.
- Do not send opponent words or provisional final scores during an active round; publish only per-player word counts until finalization.
- Use server timestamps and idempotent commands to resist timer and replay manipulation.
- Record minimal security events for invite use, membership removal, round start, and score finalization without logging secret tokens or full session cookies.
- Verify Clerk webhook signatures, make webhook handling idempotent, and minimize copied identity data.
- Treat friendly display names as untrusted user content everywhere they render, and rate-limit profile updates.
- Keep password fields and password-change requests inside Clerk's frontend/session APIs; never send them to application endpoints.
- Define tiered retention: keep compact match summaries for history until the player/account is deleted, while deleting or compacting detailed event streams and word submissions after a shorter period such as 30 days.
- Authorize every history list/detail query by participation in the underlying match; platform membership alone is insufficient.

This is a friendly-game fairness model, not a high-stakes anti-cheat system. A determined player can still use a solver after receiving the board. Make that limitation explicit rather than implying tournament-grade protection.

## 11. Accessibility and responsive behavior

Desktop is the required MVP target. Tablet and mobile layouts should remain structurally possible, but polished mobile gameplay is a post-MVP enhancement unless capacity remains after the desktop launch gates pass.

- The board supports pointer, touch-drag, and keyboard path selection.
- Each tile exposes its letter, row/column, selected state, and availability; selection updates are announced without flooding the live region.
- Timer announcements occur at meaningful thresholds, not every second, and do not rely on color alone.
- Focus remains predictable when a round starts, a modal closes, or results replace the game board.
- Reduced-motion mode removes nonessential countdown and ranking transitions.
- Score tables have real headings and a compact card alternative on narrow screens.
- All presence, ready, accepted/rejected, connection, and winner states have text equivalents.
- The root document declares `lang="en-US"`; accessible names and announcements use the same locale.

## 12. Observability and operations

- Structured Cloudflare logs include request/event ID, match ID, game key/version, member ID, action, result, Durable Object location-neutral ID, and latency; never include invite/session secrets.
- Metrics cover active rooms, WebSocket connections, reconnect rate, command rejection rate, submission latency, scoring duration, and round-finalization failures.
- Health checks separately report Pages Functions, D1 binding/query readiness, and Durable Object RPC readiness.
- Durable Object alarms finalize timed rounds. A scheduled reconciliation path queries D1 for active matches past their expected deadline and asks the named match object to reconcile idempotently.
- D1 and Durable Object migrations run as explicit, ordered deployment steps with rollback/forward-fix notes.
- Index D1 access paths for Clerk user ID, match membership, invite digest, match completion time, player history, and result idempotency key. Use prepared statements and batched writes where atomic D1 behavior is required.

## 13. Testing strategy

### Unit

- Game registry uniqueness, manifest validation, capability handling, event evolution, and viewer projections.
- Seeded, repetition-aware board generation and multi-letter tile behavior.
- Board generation and adjacency validation at 4 × 4, 5 × 5, and 6 × 6.
- Settings-schema acceptance and rejection for every allowed/disallowed board size, timer, and minimum word length.
- Settings-schema acceptance and rejection for round counts 1–5, with 3 as the default.
- All valid/invalid adjacency paths, including repeated tiles and diagonals.
- Dictionary normalization and exclusion rules.
- Standard score boundaries and multiplayer duplicate cancellation.
- State-machine permissions and transitions.

### Integration

- A minimal test game can register, create state, receive a command, emit an event, snapshot, reconnect, and finalize scores without Boggle imports.
- Clerk-invitation-only platform access, authenticated API access, unauthenticated rejection, deleted-user behavior, and mocked session claims.
- Friendly display-name updates validate input, update Clerk `publicMetadata`, refresh the local snapshot, and preserve historical match-member snapshots.
- Password changes use Clerk's account/user APIs and never traverse an application API handler.
- Invite creation, expiry, revocation, use limits, and session recovery.
- Invite intent survives sign-in without exposing the raw token in post-auth redirects, logs, or analytics.
- A reusable match invite admits multiple approved Clerk users but cannot create duplicate membership for the same user.
- Match invites reject new joins after host revocation, match start, or player-limit exhaustion.
- Active-round projections expose opponent word counts but never opponent words or provisional final scores.
- Match-history list and detail endpoints return only matches in which the authenticated user participated.
- Concurrent start/finalize commands remain idempotent.
- Submissions at start/end boundaries use authoritative time.
- Database constraints and transaction rollback behavior.
- WebSocket snapshot plus ordered event recovery.
- Durable Object eviction/rehydration, hibernating WebSocket attachments, alarm retries, and finalization-outbox retries into D1.

### End-to-end

- Host chooses Boggle, creates a match, two players join, ready up, play, and see identical results.
- Refresh/reconnect during lobby and active round.
- Expired invite, removed player, host disconnect, and server recovery flows.
- Desktop keyboard and pointer play.
- Optional stretch coverage for mobile touch play and narrow-screen adaptation.
- Automated accessibility checks plus manual screen-reader and zoom passes.
- US English copy snapshot checks, `Intl` formatting tests, and missing-message detection.

## 14. Delivery phases

### Phase 0 — Platform contracts and Cloudflare foundations

- Confirm the Cloudflare account/projects, Pages environments, D1 database, separate Durable Object Worker, Clerk instance, dashboard-only invitation workflow and allowed sign-in methods, dictionary/license, rules, and tiered retention.
- Replace starter branding and document environment variables.
- Establish `en-US` message files, formatting helpers, error-code translation, and missing-message CI checks without enabling a locale switcher.
- Install and configure `@clerk/nuxt`, protected page middleware, authenticated API middleware, sign-in/sign-up routes, and local test helpers.
- Add the account route, friendly display-name endpoint backed by `updateUserMetadata()`, and Clerk password/security controls.
- Define the game manifest, command/event/state, projection, capability, and scoreboard contracts.
- Add D1 schema/migrations, the match Durable Object with SQLite migrations, generic event/snapshot persistence, local Wrangler/Nitro bindings, generated Cloudflare types, shared validation, test harnesses, and CI checks.
- Implement a tiny non-production test game to prove registration and lifecycle boundaries.

**Exit:** local app boots against disposable services; the test game runs end to end; lint, typecheck, unit tests, import-boundary tests, and migrations pass.

### Phase 1 — Boggle game module

- Implement board generation, tile-path validation, normalization, dictionary adapter, duplicate handling, and scoring as pure modules.
- Implement the versioned Boggle settings schema and size-appropriate board distributions for 4 × 4, 5 × 5, and 6 × 6.
- Build exhaustive deterministic unit tests.

**Exit:** the engine can replay a seeded round and always produce the same accepted words and scores.

### Phase 2 — Private matches and invites

- Implement authenticated catalog selection, match creation, Clerk-linked memberships, hashed invites, opaque invite intents, redemption, revocation, and authorization without Boggle-specific logic.
- Build create/join screens and route middleware.

**Exit:** signed-out users cannot access protected room data; authenticated but uninvited users cannot access room state; valid invitees can authenticate, join, and rejoin.

### Phase 3 — Shared lobby and game runtime

- Implement the per-match Durable Object, hibernating room WebSockets, presence, ready state, generic command dispatch, projections, SQLite snapshots/events, reconnect, alarms, finalization outbox, and host controls.
- Build the responsive lobby and invite panel.

**Exit:** 2–8 browser sessions maintain a consistent roster under refresh and short disconnects.

### Phase 4 — Boggle active round

- Implement server-owned round transitions and clock, interactive board input, word submission feedback, and recovery.
- Add rate limits and command idempotency.

**Exit:** every client sees the same board and end time; only server-accepted submissions persist.

### Phase 5 — Scoreboard contract and Boggle results

- Implement generic ranking primitives and a versioned scoreboard projection contract.
- Let Boggle finalize rounds transactionally, cancel duplicates, calculate ranks, and publish its projection.
- Build Boggle personal word breakdown, round ranking, cumulative scoreboard, shared finished-match state, and durable player match history.

**Exit:** all clients render identical persisted results after reconnect; ties are deterministic and clearly presented.

### Phase 6 — Hardening and launch

- Complete error/recovery states, accessibility, responsive polish, security review, observability, load tests, and retention jobs.
- Test Durable Object hibernation/eviction, alarm retry behavior, D1 overload/backoff paths, Pages preview/production bindings, and compatible rolling deploys across Pages and the match-runtime Worker.

**Exit:** acceptance tests pass in the production-like environment, and operational dashboards and rollback steps are documented.

### Optional post-MVP — Mobile adaptation

- Adapt the active board, lobby, scoreboards, history, and account surfaces to narrow screens.
- Add touch-drag tuning, device testing, safe-area handling, mobile reconnect behavior, and mobile-specific accessibility checks.

**Exit:** the complete match flow works on supported mobile browsers without changing server or game-module contracts.

## 15. Definition of done

- All MVP success criteria are demonstrated in an end-to-end test and a manual multi-browser desktop session.
- Match state and scores remain correct across refreshes, reconnects, duplicate commands, and application restarts.
- No private match can be enumerated or joined without both a valid Clerk session and active match membership.
- Platform modules contain no Boggle imports, and the test game passes the same lifecycle contract suite as Boggle.
- Adding a game does not require edits to invitation, membership, presence, transport, or session modules; only registry additions and capability-driven shared UI extensions are allowed.
- Accessibility checks pass with no critical issues, and the complete round is playable without a pointer.
- The production environment has rate limits, secret rotation, D1 backups/Time Travel policy, Durable Object migrations, health checks, metrics, and a tested rollback/forward-fix path.
- Product rules, dictionary/version, deployment architecture, environment setup, and incident recovery are documented.
- No hardcoded user-facing prose exists outside approved `en-US` messages or game content fixtures, except where required by Clerk configuration.

## 16. V2 game roadmap

V2 adds games only after the Boggle MVP and shared platform pass their launch gates. Neither game should add conditional branches to platform identity, invitation, transport, presence, or history services; each arrives through the game registry and capability contracts.

### UNO

- Model a turn-based card game with a directional play order, draw/discard piles, hidden player hands, wild choices, penalties, round completion, and cumulative scoring.
- Use participant-specific projections so each player receives their own hand while opponents receive only card counts.
- Add capabilities for `turnBased`, `hiddenPlayerState`, `directionalTurnOrder`, `rounds`, and `cumulativeScoring`.
- Add card-table UI, hand interaction, accessible card descriptions, and reconnect behavior that never leaks hidden cards.
- Complete a licensing, trademark, and rules review before public release or branded promotion.

### Farkle

- Model turn-based dice rolling, held dice, scoring combinations, busts, banking, target score, and final-round behavior.
- Add capabilities for `turnBased`, `dicePool`, `pressYourLuck`, and `cumulativeScoring`.
- Add deterministic dice events, an auditable score breakdown, keyboard-accessible dice selection, and clear bank/roll action hierarchy.
- Reuse the shared lobby, presence, match history, and scoreboard primitives while supplying Farkle-specific turn and scoring projections.

### V2 architecture gate

- UNO and Farkle both pass the same game-module contract suite used by Boggle and the test game.
- UNO proves hidden-information projections and strict turn order without platform-core changes.
- Farkle proves turn-based dice state and press-your-luck scoring without platform-core changes.
- Match history can render game-specific score summaries through versioned projections without knowing either game's rules.
- The MVP interface remains Boggle-only; v2 games appear in the catalog only when their definitions and production readiness flags are enabled.

### Future localization

Additional languages are post-MVP and should be scheduled independently from UNO and Farkle. A locale is ready only when platform messages, Clerk surfaces, game instructions, validation errors, date/number formatting, accessibility announcements, and an appropriately licensed game dictionary have all been translated and tested. Do not expose a language selector for partial locales.

## 17. Wireframe scope

The first design artifact should establish a reusable platform shell while giving Boggle a distinct play surface. Required states are shown at desktop width. The active-round mobile wireframe is an optional adaptation reference, not an MVP commitment:

1. Authenticated game catalog / create private match, with Boggle as the available game, configuration controls for board size, round time, minimum valid word length, and 1–5 rounds, plus a layout that can accept future game manifests.
2. Invite redemption with signed-out Clerk handoff, platform-access-required, and signed-in friendly-name confirmation states in the shared platform shell.
3. Host lobby with Boggle identity, invite controls, roster, ready states, and disabled/enabled start behavior.
4. Boggle active round with dominant board, timer, word composer/history, connection status, and compact standings.
5. Boggle round results rendered through shared ranking primitives, including duplicate-word treatment and the host next-round action.
6. Final cumulative scoreboard with winner, per-round totals, and rematch/leave actions.
7. Player match-history scoreboard with game, date, participants, placement, and score.
8. Account management with an editable friendly display name and Clerk-managed password/security section.

## 18. Authentication references

- [Clerk Nuxt SDK overview](https://clerk.com/docs/references/nuxt/overview/)
- [Clerk Nuxt quickstart](https://clerk.com/docs/nuxt/getting-started/quickstart)
- [Protect Nuxt content and API routes](https://clerk.com/docs/nuxt/guides/secure/protect-content)
- [`clerkMiddleware()` for Nuxt API routes](https://clerk.com/docs/reference/nuxt/clerk-middleware)
- [Clerk `UserProfile` for profile and security management](https://clerk.com/docs/nuxt/reference/components/user/user-profile)
- [Clerk Backend API `updateUserMetadata()`](https://clerk.com/docs/reference/backend/user/update-user-metadata)
- [Clerk User object `updatePassword()`](https://clerk.com/docs/nuxt/reference/objects/user)

## 19. Cloudflare references

- [Deploy Nuxt to Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nuxt-site/)
- [Cloudflare Pages bindings for D1 and Durable Objects](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Durable Objects overview](https://developers.cloudflare.com/durable-objects/)
- [Durable Object WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [Cloudflare D1 API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
