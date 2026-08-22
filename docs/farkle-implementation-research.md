# Farkle implementation research

Date: 2026-08-22

## Executive summary

Farkle fits the product's Durable Object model well, but the current implementation is still Boggle-specific below the catalog layer. The safest implementation starts by activating the game boundary that the original architecture document describes, then adds Farkle as the first genuinely separate game module.

The recommended design has four distinct layers:

1. A generic random and dice package produces fair, testable rolls for arbitrary dice.
2. A pure Farkle rules module evaluates scoring selections and advances turn state.
3. The match Durable Object remains authoritative for commands, randomness, persistence, idempotency, and projections.
4. An optional Three.js client component animates already-decided outcomes. Animation never generates or changes a die value.

Use the complete PlayMonster rules as the initial `classic.v1` ruleset, including a fixed 500-point opening threshold, hot dice, and one final turn for every opponent. During setup, the host selects a winning score of 1,000, 5,000, or 10,000 points; 10,000 remains the default from the published game. The locked digital-table extensions use an animated high-roll contest, repeated sudden-death turns for tied leaders, and a role-aware skip after the active player remains disconnected for 60 seconds. The setup and rules interface must state that three ones score 300 because many house rules use 1,000.

Do not add a physics engine for the first version. A short outcome-driven Three.js animation provides the desired polish, lands reliably on the server-provided faces, behaves consistently across devices, and avoids coupling game correctness to floating-point physics.

## Scope

This document covers rules, randomness, scoring, state transitions, server integration, client rendering, accessibility, testing, and an incremental implementation sequence. It does not change application code or dependencies.

## Current architecture findings

### Foundations that are ready to reuse

- One Cloudflare Durable Object serializes all commands for a match, persists room state before broadcast, and provides HTTP plus WebSocket delivery in [`workers/match-room/src/index.ts`](../workers/match-room/src/index.ts).
- Commands already carry idempotency keys, and the Durable Object records processed keys. Roll and bank actions can use the same protection.
- Match membership, lobby readiness, invitations, reconnection, presence, chat, final score projections, history, and leaderboards are platform concerns that Farkle can reuse.
- The repository already defines a versioned `GameManifest` and a proposed generic `GameDefinition` in [`shared/games/contract.ts`](../shared/games/contract.ts).
- Game keys are versioned (`boggle.v1`), which is the correct compatibility model for a rules-heavy dice game.
- D1 stores integer scores and JSON result payloads. Farkle totals fit those existing projections without a game-specific D1 table.

### Boggle coupling that must be removed

The generic contract exists, but production code does not use it. `GameDefinition` currently has no implementation or caller. The following hard-coded boundaries prevent Farkle from being additive:

| Boundary | Current coupling | Required change |
| --- | --- | --- |
| Room state | [`workers/match-room/src/types.ts`](../workers/match-room/src/types.ts) imports Boggle settings, board, submissions, and scores and restricts `gameKey` to `boggle.v1`. | Nest versioned, game-owned state under a generic platform room state. |
| Command parsing | The platform and Boggle commands share `matchCommandSchema` in [`shared/games/boggle/schema.ts`](../shared/games/boggle/schema.ts). | Move platform commands to a platform schema and let the selected game parse its own commands. |
| Command execution | [`workers/match-room/src/index.ts`](../workers/match-room/src/index.ts) calls Boggle functions and owns Boggle rounds directly. | Resolve a runtime game definition from `state.gameKey` and delegate game commands, alarms, projection, and final scoring. |
| API types | [`shared/types/api.ts`](../shared/types/api.ts) flattens Boggle fields into `MatchView`. | Use a discriminated union with platform fields plus a game-specific player view. |
| Projection | [`workers/match-room/src/projection.ts`](../workers/match-room/src/projection.ts) knows Boggle secrecy and word counts. | Keep platform member/presence projection generic and call the game definition for the game view. |
| Match creation | [`server/utils/matches.ts`](../server/utils/matches.ts) always validates Boggle settings and inserts `boggle.v1`. | Accept `gameKey`, resolve its manifest/schema, validate settings, and initialize that game. |
| Capacity | The server checks a literal eight-player limit; the D1 trigger also enforces eight. | Keep eight as a platform hard ceiling, but use `manifest.maxPlayers` for each match. |
| Room UI | [`app/components/match/Room.vue`](../app/components/match/Room.vue) renders Boggle components directly. | Add a client UI registry keyed by the discriminant. |
| Lobby/results | Lobby settings and final-result copy assume boards and rounds. | Split generic shell/scoreboard UI from game-owned rules summaries and result copy. |
| Catalog/history | Create links and some game-name mappings are hard-coded to Boggle. | Derive route, name, and labels from the registry. |
| Persistence | Durable Object storage contains one flattened JSON snapshot with no state version or migration. | Add a room-state version and migrate existing Boggle snapshots when read. |
| Alarms | The one alarm assumes a Boggle round end. | Let each game report its next deadline; the platform schedules the earliest deadline. |
| Finalization | The history payload always writes `{ rounds }`. | Let each game return a generic score plus a game-specific summary payload. |

The D1 status values can remain unchanged for Farkle. A Farkle match uses `lobby`, `active`, `finished`, and `cancelled`; turn phases belong inside its game state. `round_results` remains available to Boggle but must not become a platform assumption.

## Locked Farkle ruleset

Farkle has many house rules. The first release should bind every match to a named, immutable rules version instead of exposing many toggles. The published PlayMonster rules provide the baseline, while `classic.v1` also records the locked sudden-death and disconnection behavior required by this digital table.

### `classic.v1` defaults

| Rule | Locked value |
| --- | --- |
| Players | 2–8 within the platform's existing hard ceiling |
| Dice | Six fair six-sided dice |
| Starting player | The server runs an animated one-die high-roll contest and rerolls tied leaders until one player starts |
| Turn direction | Lobby join order, rotated so the opening-roll winner is first |
| Opening threshold | A player must bank at least 500 points to enter the scoreboard |
| Winning score | Host chooses 1,000, 5,000, or 10,000 points; default 10,000 |
| Hot dice | After scoring all available dice, roll all six again and retain the turn total |
| Farkle | A roll with no legal scoring selection loses the entire unbanked turn total |
| Final round | When a player reaches the selected winning score, every other player receives exactly one final turn |
| Winner | Highest banked total after final turns and any sudden-death cycles finish |
| Tie policy | Tied leaders play one additional complete turn each; repeat with the new tied leaders until one player leads |
| Disconnection | After 60 continuous seconds disconnected, the host may skip a non-host; any connected non-active player may skip the host |

### Score table

| Selection from one roll | Score |
| --- | ---: |
| One 1 | 100 |
| One 5 | 50 |
| Three 1s | 300 |
| Three 2s | 200 |
| Three 3s | 300 |
| Three 4s | 400 |
| Three 5s | 500 |
| Three 6s | 600 |
| Four of a kind | 1,000 |
| Five of a kind | 2,000 |
| Six of a kind | 3,000 |
| 1–6 straight | 1,500 |
| Three pairs | 1,500 |
| Four of a kind plus a pair | 1,500 |
| Two triplets | 2,500 |

Scoring groups cannot cross roll boundaries. For example, one 5 from one roll and two 5s from the next roll score 150 total, not a triple. A player may choose a lower-value legal subset when that leaves more dice to roll; research on optimal Farkle play confirms that taking the maximum immediate score is not always the best decision.

### Turn flow

```text
awaiting roll
    |
    v
server rolls available dice
    |
    +-- no scoring option --> Farkle --> lose turn total --> next player
    |
    v
awaiting selection
    |
    +-- bank selected scoring dice --> validate entry threshold --> add total --> next player
    |
    +-- continue with selected scoring dice
            |
            +-- some dice remain --> roll remaining dice
            |
            +-- all dice score --> hot dice --> roll all six
```

The final-turn queue starts only after a successful bank reaches the match's selected target. It contains every other member once, in turn order. Later players can overtake the triggering score, but nobody receives a second normal final turn.

When the final-turn queue empties with tied leaders, the game enters sudden death. Each tied leader receives one complete turn in table order. After that cycle, only the players tied at the new highest score continue into another cycle; repeat until one player has the highest score. Players who were not tied for the lead when sudden death began cannot re-enter it.

### Locked product decisions

1. **Three ones:** Score 300 in `classic.v1`, matching the cited published rules.
2. **Ties:** Run complete-turn sudden-death cycles among the tied leaders until one player leads.
3. **Disconnected active player:** After 60 continuous seconds disconnected, let the host skip a non-host active player. When the active player is the disconnected host, let any connected non-active player perform the skip. Skipping forfeits the current unbanked turn total and advances play as a zero-point turn.
4. **Opening roll:** Run a server-authoritative high-roll contest. Roll one die for every player at match start, reroll only tied leaders, and animate every contest round before presenting the starting player.
5. **Winning score:** Let the host choose 1,000, 5,000, or 10,000 points during match setup. Default to 10,000.

Keep first-release settings intentionally small:

```ts
interface FarkleSettings {
  rulesVersion: 'classic.v1'
  targetScore: 1_000 | 5_000 | 10_000
  locale: 'en-US'
}
```

Derive the opening threshold and score table from the immutable rule configuration. Store the selected `targetScore` in validated match settings because it varies per match. Add another rules version when the product intentionally supports a different scoring or turn rule.

Changing the winning score does not scale the opening threshold. Every `classic.v1` match still requires an initial bank of at least 500 points, including a 1,000-point match.

## Reusable randomness and dice architecture

### Design goals

The dice layer should support Farkle now and numeric or custom-faced dice games later. It must provide:

- unbiased face selection;
- independent rolls;
- server-authoritative production entropy;
- deterministic test and simulation sources;
- stable die and roll identifiers for commands and animation;
- no dependency on Farkle scoring or Three.js;
- arbitrary face types, not only `d6` numbers.

### Proposed package layout

```text
shared/
  random/
    types.ts              # RandomSource contract
    uniform.ts            # unbiased uniformIndex / uniformInt
    shuffle.ts            # Fisher–Yates using uniformIndex
    seeded.ts             # deterministic test/simulation source only
  dice/
    types.ts              # DieDefinition, RolledDie, DiceRoll
    roller.ts             # generic face rolling
    numeric.ts            # d4, d6, d8, d10, d12, d20 helpers
workers/match-room/src/
  random.ts               # WebCryptoRandomSource adapter
```

Keep Boggle's board candidate selection separate. That algorithm intentionally chooses the least repetitive of many candidates, so it is not a uniform physical-dice simulation. Boggle can later reuse `uniformIndex` and `shuffle` without claiming that its final board distribution is uniform.

### Core contracts

The shared package should depend on an integer source rather than on `Math.random()` or the Web Crypto global directly:

```ts
export interface RandomSource {
  nextUint32(): number
}

export interface DieDefinition<Face> {
  id: string
  faces: readonly Face[]
}

export interface RolledDie<Face> {
  id: string
  face: Face
  faceIndex: number
}

export interface DiceRoll<Face> {
  id: string
  algorithmVersion: string
  rolledAt: number
  dice: readonly RolledDie<Face>[]
}
```

Every entry in `faces` has equal probability. Repeated entries can represent a deliberately weighted physical die later, but a separate `WeightedDieDefinition` would communicate that intent more clearly if weighted dice become a product feature.

### Unbiased bounded integers

Cloudflare Workers exposes `crypto.getRandomValues()`, which fills integer typed arrays with cryptographically strong random values. Generate production rolls only inside the authoritative Durable Object.

Converting a 32-bit value to a face with `value % sides` creates modulo bias whenever `sides` does not divide `2^32`. The bias is tiny for a d6, but it is unnecessary and undermines a reusable fairness claim. Use rejection sampling:

```ts
const range = 0x1_0000_0000
const limit = Math.floor(range / sides) * sides

do {
  value = source.nextUint32()
} while (value >= limit)

return value % sides
```

For a d6, `limit` is 4,294,967,292. Only the top four possible 32-bit values are rejected, after which every face has exactly 715,827,882 source values. Use normal JavaScript arithmetic for this calculation; bitwise operators coerce values to signed 32-bit integers.

The production adapter should buffer a small `Uint32Array` so one six-die roll does not require six separate Web Crypto calls. Refill rejected values as necessary. Each die consumes its own accepted integer.

### Production, tests, and replay

- **Production:** `WebCryptoRandomSource` uses `crypto.getRandomValues()`. Do not use `Math.random()` or a client-supplied seed.
- **Unit tests:** `SequenceRandomSource` returns explicit integers. It makes rejection boundaries and exact rolls fully testable.
- **Simulation/property tests:** A named seeded generator such as `xoshiro128**` can generate repeatable large samples. Its own authors explicitly state that it is not cryptographically secure, so keep it out of production roll wiring.
- **Replay:** Persist resolved face values in the domain event/state before broadcasting. Replay uses stored outcomes and never regenerates a historical roll from an implementation-dependent PRNG.
- **Auditability:** Store `algorithmVersion` with each roll or turn history. Values remain replayable after an RNG adapter changes.

Publishing a match seed before or during play would let a player predict later outcomes. A commit/reveal or external randomness scheme could make server behavior independently verifiable, but it is disproportionate for this private friends-and-family product. Server-side CSPRNG outcomes plus persisted rolls protect against client manipulation and provide the appropriate first-release trust model.

### Exact Farkle probabilities

Exhaustively enumerating all `6^n` outcomes under `classic.v1` gives the following chance that a roll has no legal scoring selection:

| Dice rolled | Farkle outcomes | Total outcomes | Probability |
| ---: | ---: | ---: | ---: |
| 1 | 4 | 6 | 66.6667% |
| 2 | 16 | 36 | 44.4444% |
| 3 | 60 | 216 | 27.7778% |
| 4 | 204 | 1,296 | 15.7407% |
| 5 | 600 | 7,776 | 7.7160% |
| 6 | 1,080 | 46,656 | 2.3148% |

These counts are better regression tests than a stochastic “looks uniform” test. The six-dice count assumes that three pairs score; changing that rule changes the bust probability.

Do not make a random chi-square test a required CI check. It can fail for a correct generator and pass a broken one. Test the bounded-integer mapping deterministically, exhaustively test the small Farkle outcome space, and reserve statistical sampling for diagnostics.

## Farkle domain module

### Proposed module layout

```text
shared/games/farkle/
  index.ts
  manifest.ts
  types.ts
  schema.ts
  rules.ts              # immutable classic.v1 score configuration
  scoring.ts            # pure selection evaluation and option enumeration
  engine.ts             # commands, events, evolve, final-turn queue
  projection.ts         # viewer-safe game projection
```

The module must not import Cloudflare, Nuxt, Vue, Three.js, or D1 types.

### State shape

```ts
interface FarkleState {
  rulesVersion: 'classic.v1'
  phase: 'opening-roll' | 'playing' | 'final-turns' | 'sudden-death' | 'finished'
  turnOrder: string[]
  activeTurnIndex: number
  turnNumber: number
  scores: Record<string, number>
  hasEnteredScoreboard: Record<string, boolean>
  turn?: {
    memberId: string
    startedAt: number
    unbankedScore: number
    availableDieIds: string[]
    currentRoll?: DiceRoll<number>
    committedSelections: FarkleSelection[]
  }
  openingRollRounds: Array<{
    rollId: string
    valuesByMemberId: Record<string, number>
    tiedLeaderMemberIds: string[]
  }>
  finalRound?: {
    triggeredByMemberId: string
    remainingMemberIds: string[]
  }
  suddenDeath?: {
    cycle: number
    eligibleMemberIds: string[]
    remainingMemberIds: string[]
  }
  winnerMemberId?: string
}
```

Stable physical die IDs (`d1` through `d6`) simplify selection, stale-command checks, animation, and hot-dice resets. `currentRoll.id` changes on every roll. A continue or bank command includes that roll ID so a delayed duplicate cannot act on newer dice.

The opening contest stores every roll round so clients can animate the initial results and any tied-leader rerolls in order. The server resolves all opening rolls automatically when the host starts the match; players do not send separate opening-roll commands.

`FarkleSettings` remains alongside game state in the generic room envelope. Pass settings into command decisions, projections, and finalization so target checks use the persisted match value. Do not duplicate `targetScore` inside `FarkleState`, where it could drift from the validated settings.

The state may keep a bounded turn history for results and animation, but it should not grow for the life of a long match. Retain the current turn plus per-player summary statistics in the snapshot; store a bounded recent event history or compact older rolls if detailed history becomes a feature.

### Commands

```ts
type FarkleCommand
  = { type: 'farkle.roll', idempotencyKey: string }
  | { type: 'farkle.continue', idempotencyKey: string, rollId: string, selectedDieIds: string[] }
  | { type: 'farkle.bank', idempotencyKey: string, rollId: string, selectedDieIds: string[] }
  | { type: 'farkle.turn.skip', idempotencyKey: string, memberId: string }
```

Selection stays local until the player chooses Continue or Bank. Each action atomically submits the selection and intent. This avoids a chatty `selection.set` protocol and eliminates races between selecting dice and acting on them.

The server validates all of the following:

- the actor is the active player for Roll, Continue, and Bank;
- the game and turn are in the expected phase;
- `rollId` matches the current roll for Continue and Bank;
- selected IDs are unique and belong to the current roll;
- the selection for Continue or Bank is nonempty and every selected die contributes to a legal score;
- Continue leaves the correct dice count or activates hot dice;
- Bank satisfies the opening threshold when the player has not entered the scoreboard;
- final-turn and sudden-death queues are satisfied;
- the actor is authorized to skip the target, the target is still the active player, and the server-calculated 60-second grace period has elapsed.

The platform presence layer must support the skip decision authoritatively. Record when the active member loses their final room socket, and calculate `skipEligibleAt` as 60 seconds after the later of the turn start or the most recent disconnect/activity boundary. A reconnect or any authenticated room command clears or restarts the grace period. This prevents an authorized player from skipping someone who is still acting through the HTTP fallback while their WebSocket reconnects.

Only mark a member disconnected when their final socket closes. Multiple tabs must not start the grace period while one healthy room connection remains. The Durable Object serializes a reconnect, player action, and host skip if they arrive together, so the first accepted action determines the result without a race.

### Events

Resolved rolls belong in events so state evolution and replay remain deterministic:

```text
farkle.opening-die.rolled
farkle.turn.started
farkle.dice.rolled
farkle.dice.selected
farkle.turn.banked
farkle.turn.farkled
farkle.turn.skipped
farkle.final-turns.started
farkle.sudden-death.started
farkle.sudden-death.cycle-started
farkle.match.finished
```

The existing snapshot protocol can remain the browser source of truth. A new roll ID in a snapshot is enough to trigger animation. Transient `game.event` envelopes can be added later for sound and richer presentation, but clients must still recover from a snapshot alone.

### Scoring algorithm

Farkle scoring is a selection problem, not just a total for the full roll. A player can often keep several different legal subsets.

For at most six rolled dice, enumerate every nonempty subset (`2^6 - 1 = 63`) and run a pure `scoreSelection()` function. Retain valid results and deduplicate equivalent value choices for hints while preserving die IDs for commands. Exhaustive enumeration is easier to verify than a greedy scorer and is effectively free at this size.

`scoreSelection()` should apply rules in this order:

1. Recognize exact six-dice combinations: six of a kind, straight, three pairs, four plus pair, and two triplets.
2. Recognize five and four of a kind.
3. Recognize triples.
4. Score remaining individual ones and fives.
5. Reject the selection if any selected die remains unconsumed.

Whole-roll special combinations take precedence over additive alternatives. The function should return a structured breakdown, not only a number, so the UI can explain “four of a kind + pair · 1,500.” The client may call the same pure function for previews, but the server always recomputes the result.

## Runtime integration

### Make the game contract operational

Use an incremental runtime interface rather than adding Farkle branches throughout `MatchRoom`. A practical definition needs to cover startup, commands, alarms, projections, and final results:

```ts
interface RuntimeGameDefinition<Settings, State, Command, Event, View> {
  manifest: GameManifest
  settingsSchema: StandardSchemaV1<Settings>
  commandSchema: StandardSchemaV1<Command>
  createInitialState(context: GameStartContext<Settings>): State
  decide(context: GameCommandContext<State, Command>, services: GameServices): Event[]
  evolve(state: State, event: Event): State
  handleDeadline?(context: GameDeadlineContext<State>, services: GameServices): Event[]
  nextDeadlineAt(state: State): number | undefined
  project(state: State, viewer: ViewerContext): View
  getFinalResult(state: State): GameFinalResult
}
```

`GameServices` supplies a `DiceRoller` backed by Web Crypto in production and by a sequence source in tests. `decide()` can consume entropy, but emitted events contain the resolved values. `evolve()` remains pure and deterministic.

Separate the registries by runtime concern:

- A shared catalog registry exposes lightweight manifests and settings schemas.
- The Durable Object runtime registry exposes full server game definitions.
- The client UI registry maps game keys to lazy setup, room, rules-summary, and final-result components.

This separation prevents a catalog import from pulling the Boggle dictionary or server engine into a browser bundle.

The Farkle manifest should use `key: 'farkle.v1'`, `minPlayers: 2`, `maxPlayers: 8`, `rounds: false`, `simultaneousPlay: false`, `cumulativeScoring: true`, and `spectators: false`. The current booleans can describe this release, but a future manifest revision should prefer an explicit interaction mode such as `'simultaneous' | 'turn-based' | 'asynchronous'` instead of accumulating overlapping booleans.

### Generic room state and view

Persist platform state and game state separately:

```ts
interface RoomState {
  stateVersion: 2
  id: string
  name: string
  status: MatchStatus
  hostMemberId: string
  members: RoomMember[]
  sequence: number
  game: {
    key: GameKey
    settings: unknown
    state: unknown
  }
}
```

Use schemas from the resolved definition to validate the unknown persisted payload when loading it. At TypeScript boundaries, expose a discriminated union:

```ts
type MatchView
  = PlatformMatchView<'boggle.v1', BoggleSettings, BogglePlayerView>
  | PlatformMatchView<'farkle.v1', FarkleSettings, FarklePlayerView>
```

Do not keep Boggle fields flattened on the platform view. A nested `game` projection prevents future games from inheriting concepts such as boards, rounds, word counts, or missed words.

### Platform command routing

Move `member.ready`, `member.remove`, `match.start`, `match.cancel`, and `match.end` into a platform command schema. `MatchRoom` parses that schema first. If it does not match, it resolves the current game definition and parses a game command.

The platform owns membership and top-level lifecycle checks. The game owns whose turn it is, whether a selection scores, how a turn ends, when the final-turn queue begins, and the final scoreboard.

### Presence and disconnect skips

The current room derives `connected` from live sockets and does not persist a disconnect timestamp. Add generic presence metadata that records when a member's final room socket closes and the most recent authenticated room activity. A reconnect clears the disconnect marker, while an HTTP fallback command proves activity and restarts the grace window even if no WebSocket is open.

The Farkle projection exposes `skipEligibleAt` only when the active player is disconnected and derives `canSkipActivePlayer` for each viewer. The host receives that capability when a non-host is active. When the disconnected host is active, every connected non-active player receives it. Clients calculate the visible countdown with the existing server-time offset.

`farkle.turn.skip` remains a manual action. The server rechecks the actor's role and connection, socket presence for the target, activity time, active member, and the absolute deadline when the command arrives. The active player can never skip their own turn.

Skipping ends the turn exactly like a zero-point resolution: discard the active player's unbanked total, record a skipped-turn event, and advance the appropriate normal, final-turn, or sudden-death queue. A reconnect or player action that the Durable Object serializes before the skip command makes the skip ineligible.

### Creation and invitations

Change match creation to accept `{ gameKey, name, settings }`. Resolve the catalog entry, validate settings with its schema, persist its key/version, and initialize the corresponding game state. Use the selected manifest for minimum and maximum player validation.

The D1 eight-member trigger can remain as a global safety ceiling. Application checks must still use `manifest.maxPlayers`, and invitation `max_uses` should derive from that limit rather than from a Boggle literal.

### Alarms and deadlines

The Durable Object has one replaceable alarm. After every transition, ask the selected game for `nextDeadlineAt(state)` and set or delete the alarm. Boggle returns its round deadline. Farkle does not need an alarm for the manual 60-second skip because the client can count down to `skipEligibleAt` and the server validates the timestamp when an authorized player acts.

Alarm delivery is at least once, so deadline handling must remain idempotent. Never use client animation completion as an authoritative deadline.

### Finalization and history

Keep the existing integer `score` projection. Farkle's final result can add a JSON summary such as:

```json
{
  "rulesVersion": "classic.v1",
  "targetScore": 5000,
  "turns": 18,
  "farkles": 4,
  "highestBankedTurn": 1250
}
```

The game definition should return ranked member IDs, numeric scores, winner IDs, and this payload. The platform finalization outbox remains responsible for idempotent D1 delivery.

Sudden death guarantees one match winner. Update ranking helpers to use competition ranks for equal non-winning scores because the current display-name tiebreak makes equally scoring players appear to have different placements.

### Snapshot migration

Existing Durable Object snapshots have no `stateVersion` and store Boggle fields at the root. Introduce a read migration that recognizes that shape and wraps it as `stateVersion: 2` plus a `boggle.v1` game payload. Write only the new shape after migration.

This migration is required even if no public matches are expected to be active during deployment. Durable Object storage survives process and code upgrades.

## Three.js dice animation

### Recommendation

Use direct Three.js as an optional, client-only renderer behind a DOM-based `DiceTray` contract. Do not add a Vue scene framework or a physics engine for the first version.

Three.js provides the useful primitives directly: a WebGL renderer, quaternions for stable orientation interpolation, canvas textures for pips, and an animation loop that can stop when the roll settles. Six dice do not justify `InstancedMesh`; separate meshes sharing one geometry and material set are simpler to select and orient. The official docs position instancing as an optimization for large counts.

### Component boundary

```text
app/components/dice/
  DiceTray.vue               # semantic values, selection, fallback, ARIA
  DiceScene.client.vue       # Three.js canvas only
app/utils/dice/
  faceOrientations.ts        # face value -> renderer-neutral orientation data
  rollTrajectory.ts          # deterministic visual path from roll ID + die ID
```

`DiceTray` receives resolved dice, selected IDs, selectable IDs, and the roll ID. It emits selection toggles and an optional local `settled` notification. The Three.js child receives visual state only and never emits a die value.

### Outcome-driven animation

1. The host starts the match, or the active player sends `farkle.roll` or `farkle.continue`.
2. The Durable Object validates the action, generates values, persists them, increments the sequence, and broadcasts the projection.
3. The client detects a new roll ID or a queued opening-contest roll round.
4. Each die follows a short arcing path with several visual spins.
5. The renderer interpolates to a canonical final quaternion for the server-provided face.
6. Controls remain locally disabled until the short animation settles, but the server does not depend on that callback.

Derive trajectory variation from a hash of `roll.id + die.id`. This produces consistent animation across clients and deterministic screenshots without exposing or reusing game entropy. The trajectory seed changes presentation only.

A physics simulation is unnecessary here. The official Three.js physics guide describes a separate physics world whose body transforms must be copied into render meshes and notes maintenance concerns around some JavaScript physics packages. Physics would add bundle size, fixed-step integration, collision tuning, device variance, and a difficult requirement to force predetermined faces. It would not improve roll fairness because the server has already decided the outcome.

### Visual implementation notes

- Use one shared rounded-box geometry, six face materials or a small texture atlas, a tray plane, ambient light, and one directional light.
- Render only during an active roll or resize. Start with `renderer.setAnimationLoop(callback)` and pass `null` after settling.
- Use quaternion spherical interpolation rather than Euler accumulation to avoid gimbal-lock artifacts.
- Size the canvas from its CSS box with `ResizeObserver`; cap pixel ratio at `Math.min(devicePixelRatio, 2)`.
- Prefer a fixed camera and bounded tray so mobile and desktop show the same die scale.
- Dispose geometries, materials, textures, renderer resources, observers, and the animation loop on component unmount. Three.js does not automatically free GPU resources.
- If WebGL initialization or context use fails, keep the semantic DOM dice visible and omit the decorative canvas.
- Lazy-load the client renderer only on an active Farkle table. Nuxt supports `.client.vue`, `<ClientOnly>`, and lazy component loading so Three.js does not enter the server bundle or initial Boggle route.

### Accessibility and reduced motion

The canvas is decorative and should be `aria-hidden="true"`. Render each actual die as a semantic DOM button or list item with a label such as “Die 2, value 5, selected.” Keyboard selection must not depend on canvas raycasting.

Honor `prefers-reduced-motion: reduce`. In reduced-motion mode, show the final orientation immediately or use a brief opacity crossfade with no tumbling or translation. Announce the completed roll once through a polite live region; never announce animation frames.

The DOM fallback also preserves gameplay when JavaScript graphics are delayed, WebGL is unavailable, or the client reconnects after a roll. A stale roll from a reconnect should render at rest instead of replaying every historical animation.

## Client game integration

Add a lazy UI registry keyed by `gameKey`. Each entry supplies:

- match setup component;
- lobby rules summary;
- active game component;
- optional intermediate-results component;
- final-results content and play-again route.

`MatchRoom` continues to own loading, connectivity, toast errors, chat, cancellation, history invalidation, and generic lobby/final shells. It delegates game-specific commands and rendering to the selected entry.

For Farkle, the active table should show:

- the animated opening high-roll contest and tied-leader rerolls;
- active player, final-turn, and sudden-death status;
- banked scores for every player;
- progress toward the selected winning score;
- current turn total and prospective selected score;
- six dice with selected/scoring states;
- Roll, Continue, and Bank actions with clear disabled reasons;
- the 500-point opening requirement until the active player enters;
- a skip countdown and action only for viewers authorized to skip the disconnected active player;
- a compact score-reference panel;
- connection status and host end-match control.

The setup form should present 1,000, 5,000, and 10,000 as a single-choice segmented control or radio group, with 10,000 preselected. Repeat the selected target in the setup summary and lobby rules panel so every player sees the match length before marking ready.

All Farkle dice and scores are public information. The projection still matters because only the active player should receive `canAct: true`, and future dice games may have hidden dice. Prefer capability fields in the game view over duplicating authorization logic in Vue.

## Implementation sequence

### Phase 1: Generalize the platform boundary

1. Add state versioning and a migration for existing Boggle Durable Object snapshots.
2. Split platform commands from Boggle commands.
3. Introduce nested game state and a discriminated `MatchView`.
4. Add runtime, catalog, and client UI registries.
5. Route creation, commands, projection, alarms, and finalization through the selected game definition.
6. Prove no Boggle behavior changes with the existing test suite and an end-to-end Boggle match.

### Phase 2: Add random and dice primitives

1. Add `RandomSource`, rejection-sampled bounded integers, and Fisher–Yates shuffle.
2. Add generic die definitions and rolls.
3. Add the Web Crypto production adapter and explicit-sequence test adapter.
4. Test rejection boundaries, face ranges, stable IDs, and injected outcomes.

### Phase 3: Add the pure Farkle module

1. Lock `classic.v1` score configuration and validate target scores of 1,000, 5,000, or 10,000 with a 10,000 default.
2. Implement subset enumeration and structured selection scoring.
3. Implement animated high-roll results, normal turns, hot dice, Farkles, banking, entry threshold, final turns, repeated sudden-death cycles, and final results.
4. Add command schemas, errors, events, and projections.
5. Exhaustively enumerate roll outcomes and assert the probability table in tests.

### Phase 4: Integrate Farkle with the match runtime

1. Register `farkle.v1` in the catalog and runtime.
2. Add `gameKey` to match creation and derive capacity/invite limits from the manifest.
3. Wire authoritative rolls through the Durable Object dice service.
4. Persist Farkle final summaries through the existing outbox and D1 projections.
5. Add authoritative disconnect/activity timestamps and role-aware skip validation.
6. Verify reconnects, HTTP command fallback, duplicates, and concurrent command serialization.

### Phase 5: Build the table and animation

1. Add the Farkle setup, lobby summary, table, reference card, and final-results UI.
2. Build the semantic DOM dice tray first.
3. Add the client-only Three.js visualizer as a progressive enhancement.
4. Add reduced-motion, WebGL-failure, resize, unmount, and reconnect coverage.
5. Measure the Farkle route bundle and ensure Boggle does not eagerly load Three.js.

## Test strategy

### Random and dice tests

- Reject invalid dice with fewer than two faces.
- Verify exact boundary mapping for d6, including rejection of 4,294,967,292 through 4,294,967,295.
- Verify every result lies within the face array.
- Verify each accepted source integer is consumed once and rejected integers do not become faces.
- Verify Fisher–Yates uses the injected source and does not mutate its input.
- Verify roll IDs and die IDs remain stable where the protocol requires them.

### Scoring tests

- Cover every score-table combination and additive combination.
- Cover legal partial choices from triples, four/five/six of a kind, and mixed 1/5 rolls.
- Reject selections containing a non-scoring die.
- Prove that dice from separate rolls never combine.
- Test precedence for straight, three pairs, four plus pair, and two triplets.
- Enumerate all outcomes for one through six dice and assert the exact Farkle counts above.
- Snapshot structured score breakdowns used by the UI.

### State-machine tests

- Default the target to 10,000, accept 1,000 and 5,000, and reject every unsupported target.
- Resolve the opening high-roll contest automatically and reroll only tied leaders.
- Reject actions from a non-active member.
- Reject stale roll IDs and duplicate die IDs.
- Preserve a turn total across Continue and hot dice.
- Lose the full unbanked total on a Farkle.
- Enforce 500 only until a player first banks successfully.
- Advance turn order correctly after bank and Farkle.
- Start the final-turn queue once and give every opponent one turn.
- Trigger final turns at each supported target and never at a lower banked total.
- Enter sudden death when final leaders tie, give each tied leader one complete turn, remove players who no longer share the lead, and repeat until one leader remains.
- Allow the host to skip a disconnected non-host active player after 60 seconds.
- Allow any connected non-active player to skip a disconnected active host after 60 seconds.
- Reject a skip from an unauthorized or disconnected actor, before 60 seconds, for a connected target, or for anyone other than the active player.
- Forfeit the unbanked turn total and advance the correct queue after an eligible skip.
- Reset skip eligibility after a reconnect or authenticated HTTP fallback action.
- Produce identical final state when the same stored events are replayed.
- Acknowledge duplicate idempotency keys without rolling twice.

### Runtime and projection tests

- Route Boggle and Farkle commands only to their selected definitions.
- Reject a command whose namespace does not match the match game.
- Validate persisted state through the correct game schema.
- Migrate a version-1 flattened Boggle snapshot without data loss.
- Derive maximum players and final summaries from the selected definition.
- Reconnect to a Farkle match from a snapshot without replaying stale rolls.
- Start a disconnect grace period only after the member's final socket closes.
- Serialize a reconnect or player action against a simultaneous host skip without double advancement.
- Keep actor capabilities server-derived.

### UI and animation tests

- Select and unselect every die with mouse, touch, and keyboard.
- Expose die values and selection through accessible names outside the canvas.
- Disable Continue and Bank for invalid selections and explain why.
- Present opening-contest and sudden-death state without relying on color alone.
- Show the skip countdown from the absolute server timestamp only to an authorized viewer, including non-hosts when the active host is disconnected.
- Select each supported winning score during setup and repeat it accurately in the setup summary, lobby, active table, and final results.
- End every animation on the server-provided face.
- Skip tumbling when reduced motion is active.
- Stop the render loop at rest and dispose resources on unmount.
- Fall back to DOM dice if Three.js fails to initialize.
- Confirm the Three.js chunk loads on the Farkle table only.

### End-to-end scenarios

- Players create a 1,000-point match, complete an opening high-roll contest with a tied-leader reroll, enter the scoreboard, use hot dice, trigger a Farkle, bank, enter final turns, break a tie through sudden death, and finish.
- The active player refreshes between a roll and a selection and resumes safely.
- Two rapid Continue commands with one idempotency key produce one new roll.
- A WebSocket disconnect falls back to HTTP without changing the outcome.
- A disconnected non-host active player remains protected for 60 seconds, then the host skips the turn without banking its unbanked points.
- A disconnected active host remains protected for 60 seconds, then another connected player skips the turn without banking its unbanked points.
- A Boggle match remains behaviorally unchanged after runtime generalization.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Rules disagreement | Bind each match to a visible immutable rules version and call out the three-ones value. |
| Client manipulation | Generate, validate, and persist rolls only in the Durable Object. |
| Modulo bias | Use 32-bit rejection sampling for every bounded random choice. |
| Random tests become flaky | Test mappings and exhaustive outcome counts deterministically. |
| Generic refactor breaks Boggle | Generalize first, migrate stored state, and run a complete Boggle regression before registering Farkle. |
| Animation blocks play | Treat animation as local presentation; state and commands remain server authoritative. |
| Physics lands on a wrong face | Do not use physics to resolve or present the first version; tween to a canonical quaternion. |
| WebGL increases initial load | Lazy-load a `.client.vue` scene only on active Farkle tables. |
| GPU resource leaks across navigation | Stop the animation loop and explicitly dispose Three.js resources on unmount. |
| Motion causes discomfort | Respect reduced motion and keep a fully functional semantic DOM tray. |
| A turn stalls on disconnect | After 60 continuous seconds, let the host skip a non-host or any connected non-active player skip the host; any reconnect or authenticated activity resets eligibility. |
| Sudden death repeats indefinitely | Repeat complete-turn cycles only among the current tied leaders; the rules intentionally have no arbitrary score or cycle cap. |
| Equal lower scores get arbitrary ranks | Use competition ranks for non-winning ties instead of display-name tiebreaking. |

## Definition of done

Farkle is ready when:

- a Farkle match uses the same private create, invite, lobby, presence, chat, reconnection, finalization, history, and leaderboard systems as Boggle;
- production die values come from server-side Web Crypto through unbiased rejection sampling;
- stored roll values make every match state replayable;
- all legal scoring selections are available and the server rejects every illegal one;
- three ones score 300, and the opening threshold, hot dice, Farkle loss, final-turn queue, and repeated sudden-death policy match the visible rules version;
- setup accepts winning scores of 1,000, 5,000, and 10,000, defaults to 10,000, and final turns begin at the persisted selection;
- a server-authoritative animated high-roll contest selects the starting player and rerolls only tied leaders;
- after 60 continuous seconds disconnected, the host can skip a non-host active player or any connected non-active player can skip the host, and the skipped turn banks no points;
- reconnects and duplicate commands cannot produce an extra roll or bank;
- the DOM dice interface is fully playable without WebGL or motion;
- the optional Three.js scene always settles on the authoritative values and releases resources after use;
- Three.js is not present in the initial Boggle route bundle;
- existing Boggle behavior and stored room state remain compatible.

## Sources

### Rules and game analysis

- [PlayMonster Farkle rules (PDF)](https://playmonster.com/wp-content/uploads/2018/06/Farkle-Rules.pdf) — complete published rules, score table, opening threshold, hot dice, and final round.
- [Optimal Play of the Farkle Dice Game](https://cs.gettysburg.edu/~tneller/papers/talks/acg2017.pdf) — demonstrates that Farkle is a genuine selection/strategy problem and that the maximum immediate scoring choice is not always optimal.

### Randomness

- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) — confirms `crypto.getRandomValues()` support in the authoritative runtime.
- [W3C Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/#Crypto-method-getRandomValues) — defines cryptographically strong random value generation.
- [Fast Random Integer Generation in an Interval](https://arxiv.org/abs/1805.10941) — reviews unbiased bounded-integer generation and the bias/performance problem.
- [A PRNG shootout](https://prng.di.unimi.it/) — documents deterministic xoshiro-family generators and explicitly distinguishes them from cryptographically secure generators.

### Three.js, Nuxt, and accessibility

- [Three.js `WebGLRenderer`](https://threejs.org/docs/pages/WebGLRenderer.html) — renderer lifecycle and `setAnimationLoop()`.
- [Three.js `Quaternion`](https://threejs.org/docs/pages/Quaternion.html) — spherical interpolation for known final orientations.
- [Three.js `InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html) — intended draw-call optimization for large counts of shared geometry/material.
- [Three.js cleanup guide](https://threejs.org/manual/en/cleanup.html) — explicit GPU resource disposal requirements.
- [Three.js physics guide](https://threejs.org/manual/en/physics.html) — physics-world integration, fixed steps, transform synchronization, and library options.
- [Nuxt 4 `<ClientOnly>`](https://nuxt.com/docs/4.x/api/components/client-only) and [client/lazy components](https://nuxt.com/docs/4.x/directory-structure/app/components) — client-only rendering and code-splitting options.
- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) and [W3C technique C39](https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html) — detecting and honoring reduced-motion preferences.
