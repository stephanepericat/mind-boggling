# UNO Implementation Plan

Status: implemented. The server-authoritative game, private projections, setup options, results, semantic controls, and Three.js presentation are in place and covered by the repository test suite.

Confirmed product decisions: classic 108-card deck, 2–8 players, 250/500/1,000-point winning-score options, and server-only Wild Draw Four adjudication without revealing a player's hand.

### Post-implementation tabletop refinement

The first playtest feedback adds these shipped interaction requirements:

- The player's hand is sorted red, yellow, green, blue, then Wild; each color sorts numbers 0–9 before Skip, Reverse, and Draw Two.
- A responsive compression rail keeps the first and last card visible as the hand grows, while retaining horizontal access for an extreme card count.
- Playable cards rest above the pack before hover or focus; unavailable cards remain labelled and visually subdued.
- The active table color now drives a brighter four-color compass, table rim, active seat, and full-table turn beacon.
- Entering the player's turn plays a short two-note browser-generated cue after the first user interaction. A persistent, local sound control can mute it.
- Calling UNO produces a visible table callout and toast for everyone. A successful catch produces its own public notification.
- A vulnerable opponent displays a red Catch control both on their seat and in the action panel. Copy explains that any opponent must use it before the next accepted play or draw.
- Active UNO play occupies the viewport below the application header. Score details collapse to a horizontal race rail below 1,100px, and chat remains a fixed overlay, so the document does not need to scroll.

## 1. Outcome

Add `uno.v1` as the third playable game in Mind Boggling. It will use the existing private-match, invite, lobby, presence, realtime, history, and leaderboard systems; keep the Durable Object authoritative; protect every player's hidden hand; and present the match as a lively three-dimensional card table.

The rules baseline is Mattel's classic 108-card UNO game. The official winning score of 500 is the default. A host may select a shorter or longer winning score, but all card behavior and scoring remain the classic rules.

### Completion criteria

- Two to eight authenticated players can create, join, play, reconnect to, and finish a private UNO match.
- The server exclusively controls deck order, legal moves, turn order, penalties, round scoring, and the match winner.
- Each player receives their own cards and only the counts of opponents' cards; a Wild Draw Four challenge returns a server verdict without revealing the challenged hand.
- Classic action-card behavior, two-player behavior, Wild Draw Four challenges, calling/catching UNO, discard reshuffling, and last-card penalties are covered by tests.
- The setup screen includes a winning-score choice with 500 labeled as the classic default.
- Three.js supplies the shared table, card-stack, deal, play, direction, and turn-focus presentation; semantic HTML remains the accessible interaction surface.
- The experience remains usable on a narrow mobile viewport, with reduced motion, without WebGL, by keyboard, and with a screen reader.
- Existing Boggle and Farkle matches, persisted room state, and match-history behavior continue to work.

## 2. Rules authority and scope

The implementation source of truth will be Mattel's [classic 108-card UNO instructions](https://service.mattel.com/instruction_sheets/B0001-Eng.pdf). Mattel's [newer 112-card instructions](https://service.mattel.com/instruction_sheets/10020-SN70_G1_4XN_IS_Uno.pdf) are useful for comparison but include Wild Shuffle Hands and customizable cards, which do not provide one stable classic ruleset.

### Locked ruleset decisions

| Topic | `uno.v1` decision |
| --- | --- |
| Rules version | `classic-108.v1` |
| Players | 2–8 |
| Starting hand | 7 cards |
| Deck | Classic 108 cards; no Shuffle Hands or customizable cards |
| Match scoring | Round winner receives the value of every card remaining in opponents' hands |
| Winning score | Host chooses 250, 500, or 1,000; 500 is selected by default and labeled “Classic” |
| Locale | `en-US` |
| Teams/partners | Not included in v1 |
| Spectators | Not included in v1 |
| House rules | Not included in v1 |

The 250- and 1,000-point choices are clearly described as match-length variants. The 500-point option is the only one labeled as the official classic finish.

### Deck composition

- Each of red, yellow, green, and blue has one zero.
- Each color has two copies of numbers 1–9.
- Each color has two Skip, two Reverse, and two Draw Two cards.
- The deck has four Wild cards and four Wild Draw Four cards.
- Every physical card instance has a stable opaque ID even when its face matches another card.

### Normal turn

- A player may play one card matching the current top discard by color, number, or action symbol.
- A Wild may always be played.
- A Wild Draw Four may be played only when the player has no card matching the current active color. A matching number or symbol in another color does not make it illegal.
- In keeping with the physical rules, the engine permits a Wild Draw Four bluff instead of rejecting it immediately. Its legality is resolved only if the affected player challenges.
- A player with a playable card may still choose to draw.
- After drawing, the player may play only the newly drawn card if it is legal, or pass. They may not return to another card already in their hand during that turn.
- If the drawn card cannot be played, the turn ends automatically.
- Stacking Draw Two or Wild Draw Four cards is not allowed. Jump-in, 7–0, progressive drawing, double-card play, and draw-until-playable are also excluded.

### Action cards

| Card | Effect |
| --- | --- |
| Skip | The next player loses their turn. |
| Reverse | The direction changes between clockwise and counterclockwise. |
| Draw Two | The next player draws two and loses their turn. |
| Wild | The player chooses the continuing color, including the current color. |
| Wild Draw Four | The player chooses the continuing color; the next player either accepts four cards and loses their turn or challenges. |

Two-player games use Mattel's special handling: Reverse acts as Skip, Skip returns play to the same player, and after the opponent resolves a Draw Two or Wild Draw Four, play returns to the player who played it.

### First discard and dealer

- At the first round, the server gives each player a dealer-selection draw. Number cards use face value and action cards count as zero. Tied leaders draw again until one dealer remains.
- Dealer-selection cards return to the deck before the round shuffle.
- Seven cards are dealt to each player and play normally begins with the player to the dealer's left.
- A number starts normal play.
- A starting Draw Two makes the player to the dealer's left draw two and lose the turn.
- A starting Skip skips the player to the dealer's left.
- A starting Reverse makes the dealer the first player and starts play in the opposite direction.
- A starting Wild requires the player to the dealer's left to choose the active color before taking the first turn.
- A starting Wild Draw Four is returned to the draw pile and another starting discard is selected.
- For later rounds, the dealer seat moves one place clockwise. This keeps the digital table deterministic and fair without repeating the dealer-selection ceremony.

### Calling and catching UNO

- Playing a next-to-last card with “UNO” declared leaves the player safe at one card.
- A player who did not declare UNO remains vulnerable until either they call it themselves, another player catches them, or the next active player begins their turn.
- “Begins their turn” is represented by the next accepted play-or-draw command, not merely by the turn indicator moving on screen.
- Any opponent may catch the vulnerable player. The server serializes a catch and the next player's first action so only the command that arrives first succeeds.
- A successful catch makes the vulnerable player draw two cards.
- The interface never calls UNO automatically. It offers an explicit, prominent control and can atomically include the declaration with the card play.

### Wild Draw Four challenge

- Only the player required to draw four can accept or challenge.
- The server records whether the previous player held a card matching the pre-play active color; it must not recalculate legality against the new chosen color.
- On a successful challenge, the player who used Wild Draw Four draws four and the challenger draws none.
- On a failed challenge, the challenger draws six.
- The authoritative server returns only whether the play was legal and applies the penalty. It never reveals the challenged player's cards. This is the confirmed privacy adaptation of the physical “show your hand” procedure.
- A Wild Draw Four played as the last card does not finalize the round until the challenge is accepted or resolved. A successful challenge gives the apparent round winner four cards and play continues; otherwise the required cards are drawn and included in round scoring.

### Going out, draw-pile depletion, and scoring

- A round normally ends when a player has no cards after all effects and any challenge are resolved.
- If the final card is Draw Two, the next player draws two before scoring.
- If the final card is an unchallenged or legally challenged Wild Draw Four, the affected player draws four or six before scoring.
- When the draw pile is empty, preserve the top discard, shuffle all older discards with server-side randomness, and continue.
- Number cards score face value; Skip, Reverse, and Draw Two score 20; Wild and Wild Draw Four score 50.
- The round winner alone receives the sum of all opponents' remaining cards.
- When that total brings the winner to the selected target score or higher, the match ends. Otherwise the game moves to round results and the host starts the next round.

## 3. Product and interaction design

### Design thesis

The table should feel like a physical game already in motion, not a dashboard decorated with cards. The central discard pile is the visual anchor, opponents occupy real seats around it, and the active color and direction are visible as table state rather than repeated labels.

The audience is the existing friends-and-family player group. The screen's single job during play is to make the legal next action unmistakable without flattening the social drama of watching another player draw, reverse direction, or reach one card.

### Visual system

| Role | Token |
| --- | --- |
| Table night | `#11151D` |
| Card ivory | `#FFF7E6` |
| UNO red | `#E53935` |
| UNO yellow | `#FFC928` |
| UNO green | `#18A957` |
| UNO blue | `#1677E8` |

- Display: the existing Funnel Sans in heavy, slightly tightened, selectively italicized treatments for turn calls and round wins.
- Body and controls: the existing Geist family for compact, highly readable instructions and actions.
- Counts and scores: the existing IBM Plex Mono so hand sizes, round totals, and target progress remain stable while values change.
- Card faces use original geometric icons and large corner labels rather than copied Mattel artwork. Color names, symbols, and contrast borders ensure that color is never the only cue.

### Signature element

The memorable device is a “living color compass” around the discard pile. It shows the current direction, places a bright notch toward the active seat, and changes to the chosen active color. A played card travels from its seat into the compass, lands with a short physical settle, and sends one restrained color pulse through the ring.

This is also the intentional aesthetic risk: opponent seats form a shallow orbit around the center rather than living only in a conventional scoreboard sidebar. The layout directly communicates turn order and reversals. A compact score drawer remains available for precise totals.

The direction avoids green casino felt, generic neon gaming chrome, and an imitation of Mattel packaging. The four card colors carry the energy; the surrounding table stays quiet and dark enough for hands and controls to remain legible.

### Desktop layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ match / round     direction + active color       score / rules      │
├─────────────────────────────────────────────────────────────────────┤
│        [opponent]       [opponent]       [opponent]                 │
│                                                                     │
│ [opponent]          draw pile   ◉   discard          [opponent]     │
│                        living color compass                          │
│                                                                     │
│                turn instruction / challenge panel                   │
├─────────────────────────────────────────────────────────────────────┤
│  ◫  ◫  ◫  ◫  ◫  ◫  ◫       Draw       UNO       Pass              │
│                         viewer's accessible hand                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Mobile layout

```text
┌──────────────────────────────┐
│ round · color · direction    │
│ opponents: 5  3  7  UNO!    │
├──────────────────────────────┤
│       draw  ◉  discard       │
│       turn / penalty         │
├──────────────────────────────┤
│ ◫  ◫  ◫  ◫  ◫  ◫  →         │
│ Draw     UNO     Pass        │
└──────────────────────────────┘
```

On mobile, opponents become a horizontally scrollable seat strip, the camera crops tighter around the two piles, and the player's hand scrolls horizontally without shrinking cards below a comfortable touch target.

### Setup, lobby, play, and results

1. **Setup:** Match name plus three winning-score cards: 250 “Quick,” 500 “Classic,” and 1,000 “Marathon.” The side preview shows a small animated deal and a fixed rules summary: 2–8 players, seven-card hands, classic 108-card deck, no stacking.
2. **Lobby:** Reuse the common invite/readiness flow. Show the selected winning score and classic rules version. Replace the lobby's hard-coded capacity label with the selected game's manifest maximum, which is eight for UNO.
3. **Dealer reveal:** A brief opening deal shows every player's dealer-selection card, reruns ties, names the dealer, and deals the first hand. This is the one larger cinematic moment.
4. **Play:** The center scene owns public table state. The viewer's semantic hand owns selection. Illegal cards are visibly muted but remain focusable so their label can explain why they cannot be played.
5. **Color choice:** Selecting a Wild opens a four-choice sheet/popover before sending one atomic play command. Escape returns the card to the hand without changing state.
6. **Challenge:** The affected player sees “Accept 4” and “Challenge.” The server privately checks the pre-play hand, then everyone receives only the guilty/clear verdict and resulting penalty.
7. **UNO:** The UNO control is always visible near the hand, becomes visually urgent at two cards, and can be armed before playing. A vulnerable opponent's one-card badge becomes a “Catch UNO” action until the catch window closes.
8. **Round results:** Reveal remaining hands, itemize card values, show the round winner's added points and every cumulative total, then let the host deal the next round.
9. **Final results:** Reuse the platform results and history surfaces, with rounds played and the selected target included in the stored summary.

### Three.js boundary

Follow the proven Farkle pattern: the WebGL canvas is presentation, and Vue/HTML is interaction.

- A client-only table scene renders the table plane, opponent card backs, draw/discard stacks, deal paths, played-card paths, the direction compass, active-seat light, and short action-card flourishes.
- The player's hand, action buttons, color chooser, challenge controls, rules, and score details remain semantic DOM elements layered with the scene.
- One rounded-card geometry and a cached texture atlas are reused. Textures are generated locally from card metadata; duplicate faces do not allocate duplicate materials.
- Animation inputs come from authoritative card/action IDs and room sequence numbers. Reconnects settle directly to the latest snapshot instead of replaying stale actions.
- Device pixel ratio is capped, resizing uses `ResizeObserver`, inactive animation loops stop, and geometries/materials/textures/renderers are disposed on unmount.
- `prefers-reduced-motion` converts dealing and play movement to a short fade/state change. WebGL initialization failure shows the same piles, active color, direction, and recent action in DOM.

## 4. Game module design

### Planned UNO module

Create a self-contained `shared/games/uno/` module with the same boundary used by Boggle and Farkle:

| File/responsibility | Planned contents |
| --- | --- |
| `manifest.ts` | `uno.v1`, slug/name/description, 2–8 players, rounds and cumulative scoring enabled |
| `rules.ts` | Deck constants, score values, target options, and named fixed rules |
| `types.ts` | Cards, colors, direction, settings, authoritative state, pending decisions, and player projection |
| `schema.ts` | Settings and command validation |
| `deck.ts` | Classic deck creation, card lookup, play matching, score calculation, and reshuffle helpers |
| `engine.ts` | Pure state transitions for deals, turns, effects, UNO calls/catches, challenges, round completion, and scoring |
| `index.ts` | Public exports only |

The pure engine will not call Web Crypto, the clock, storage, or networking. The Durable Object supplies current time, stable IDs, and authoritative shuffled orders. Tests can therefore use known decks and reproduce every edge case.

### Settings

| Field | Values |
| --- | --- |
| `rulesVersion` | `classic-108.v1` only |
| `targetScore` | 250, 500, or 1,000; default 500 |
| `locale` | `en-US` only |

### Authoritative state

The room retains all hidden state. The UNO state needs:

- Phase: dealer selection, playing, round results, or finished.
- Stable seating order, dealer seat, active seat, and direction.
- Round number and per-member cumulative scores.
- Draw pile and discard pile as ordered card IDs.
- Hands as card IDs by member.
- Current active color, which may differ from a Wild card's printed face.
- Turn state recording whether a card was drawn and which card is eligible to be played after that draw.
- Pending UNO vulnerability, including the member and the next player's first-action boundary.
- Pending Wild Draw Four resolution, including player, challenger, chosen color, and a server-only legality result derived from the pre-play hand.
- Pending round winner while a last-card penalty or challenge remains unresolved.
- A compact public last-action record for animation and announcements.
- Match statistics needed for the final history payload, such as rounds played, cards played, cards drawn, and challenges.

### Commands

Plan for the following validated command families:

| Command | Purpose |
| --- | --- |
| `uno.card.play` | Play a card; includes chosen color for a Wild and whether UNO was declared |
| `uno.card.draw` | Draw exactly one card |
| `uno.turn.pass` | Decline to play the just-drawn legal card |
| `uno.color.choose` | Choose the active color when the opening discard is a Wild |
| `uno.call` | Safely call UNO during the open self-catch window |
| `uno.catch` | Catch the currently vulnerable one-card player |
| `uno.wild-draw-four.respond` | Accept four or challenge |
| `uno.round.continue` | Host begins the next round from round results |
| `uno.turn.resolve-disconnect` | Apply the defined legal recovery after the grace period |

Playing a Wild includes the color in the same accepted command; the server never leaves a successfully played Wild waiting indefinitely for its owner to choose a color.

### Transition invariants

- Only the active player can play, draw, or pass.
- A submitted card ID must currently be in the actor's hand.
- The server validates the match against the pre-play top card and active color.
- After a draw, only the recorded drawn card can be played.
- Wild Draw Four legality is recorded before removing the card from the hand.
- No normal turn may advance while a Wild Draw Four response is pending.
- A round cannot score until final-card penalties and challenges are complete.
- The top discard never enters a reshuffle.
- Every card ID exists in exactly one of: a player's hand, draw pile, or discard pile.
- Across those locations there are always exactly 108 unique card IDs.
- Scores only change once per completed round.
- Once a match is finished, no UNO gameplay command mutates it.

## 5. Per-player projection and privacy

Projection must happen inside the Durable Object before every snapshot is sent. The browser must never receive the full room state.

| Information | Viewer receives |
| --- | --- |
| Own hand | Card IDs and faces in stable hand order |
| Opponent hands | Count only; never card IDs or faces |
| Draw pile | Count and visual stack metadata only |
| Discard pile | Current top card plus bounded public recent-action data |
| Turn state | Active member, direction, active color, own permitted actions |
| UNO window | Vulnerable member and whether the viewer may catch |
| Wild Draw Four | Public pending state; accept/challenge actions only for the affected player |
| Challenge evidence | No cards; all players receive only the server's legal/illegal verdict and applied penalty |
| Round results | Remaining hands and itemized public scoring after the round is complete |

Privacy tests must serialize every active player view and assert that no opponent card ID, card face, pre-play hand data, or server-only legality flag is present. Logs, error messages, finalization payloads, chat, and idempotency records must also avoid hidden card data.

## 6. Platform integration

### Shared/server changes planned

- Register `uno.v1` in the shared game registry and expose it through the catalog.
- Extend the match-creation settings schema and shared command union to include UNO.
- Add UNO room state, settings, commands, and player view to the shared/discriminated unions.
- Teach room initialization, command parsing/dispatch, match start, projection, scoring lookup, and finalization summary about UNO.
- Use the existing shared Fisher–Yates shuffle with the Durable Object's Web Crypto random source. The worker produces the shuffled order and the pure engine consumes it.
- Reuse the current Durable Object room snapshot and idempotency flow; no separate realtime service is needed.
- Persist only final score projections and the compact match summary to D1. Active decks and hands stay in Durable Object storage.
- No D1 migration is expected because settings and result details already use JSON payloads and the game key is textual. Confirm this during implementation before adding any migration.
- Extend stored-room validation to accept UNO without invalidating existing state-version-2 Boggle/Farkle rooms. Only bump the room-state version if the common persisted shape changes.

### Operational disconnect behavior

Official tabletop rules do not define network disconnects, so the recovery must preserve a legal UNO outcome rather than invent a skip:

- Keep the current 60-second grace period and role-aware resolver used by Farkle.
- If the disconnected player has a normal turn, resolution draws one card for them and passes, which is a legal voluntary UNO turn even when the draw is playable.
- If the disconnected player owes a Wild Draw Four response, resolution accepts the four-card penalty.
- If an opening Wild is waiting on the disconnected first player, resolution chooses the most common color in that player's hand, using the fixed red/yellow/green/blue order to break ties.
- If they have already drawn and are deciding whether to play, resolution passes.
- If the disconnected player is the host, any connected opponent may resolve after the grace period; otherwise the connected host resolves.
- A reconnect before resolution restores the exact private hand and pending choice.

### Client changes planned

- Add `/games/uno/new` and the UNO setup form.
- Add UNO table, Three.js scene, semantic card/hand, color chooser, challenge, UNO-call/catch, rules, and round-results components.
- Add UNO commands to the realtime composable and route UNO phases in the common match room.
- Make the lobby capacity and settings summary game-aware instead of treating all non-Boggle games as Farkle or displaying `/8`.
- Remove UNO from “Coming in v2”; let its registry manifest drive the available catalog card.
- Reuse the generic player list, chat, final results, history, and leaderboard wherever their existing contracts are sufficient.

### Planned file map

New areas:

- `shared/games/uno/`
- `app/pages/games/uno/new.vue`
- `app/components/uno/`
- `app/utils/unoPresentation.ts` if event-to-animation derivation needs a dedicated pure helper
- `tests/uno-deck.test.ts`
- `tests/uno-engine.test.ts`
- `tests/uno-projection.test.ts`
- `tests/uno-presentation.test.ts`

Expected integration edits:

- `shared/games/registry.ts`
- `shared/platform/commands.ts`
- `shared/types/api.ts`
- `server/api/matches/index.post.ts`
- `workers/match-room/src/types.ts`
- `workers/match-room/src/index.ts`
- `workers/match-room/src/projection.ts`
- `app/composables/useMatchRealtime.ts`
- `app/components/match/Room.vue`
- `app/components/match/Lobby.vue`
- `app/components/catalog/GameCatalog.vue`

## 7. Accessibility and resilience

- Render the canvas `aria-hidden`; do not make ray-casting the only way to play a card.
- Render every hand card as a real button with color name, value/action, playable state, selected state, and an explanation for illegality.
- Use left/right arrows for hand navigation, Enter/Space to select/play, Escape to cancel color choice, and ordinary tab order for Draw, UNO, Pass, Accept, and Challenge.
- Announce turn changes, chosen colors, draws without card identities, skips, reversals, UNO calls/catches, challenges, round scores, and reconnection through a polite live region. Urgent action required from the viewer may use an assertive announcement sparingly.
- Use icons, text, and card edge patterns in addition to red/yellow/green/blue.
- Keep touch targets at least 44 by 44 CSS pixels and prevent a large hand from shrinking cards below that size.
- Respect reduced motion and avoid flashes, rapid repeated pulses, or animation that blocks an action.
- Keep action controls usable while the Three.js scene loads and provide a complete DOM fallback if WebGL is unavailable or context is lost.
- Reconnect from an authoritative projected snapshot, cancel obsolete client animations, and never infer a move from animation completion.

## 8. Test plan

### Rules and engine

- Verify all 108 cards, duplicate counts, stable unique IDs, and point values.
- Verify known deck orders, initial dealing, dealer ties, dealer rotation, and every first-discard branch.
- Verify matching by color/number/symbol, Wild behavior, voluntary draw, drawn-card-only play, and pass.
- Reject out-of-turn, absent-card, stale-turn, invalid-color, and duplicate commands.
- Verify Skip, Reverse, Draw Two, and direction changes for 3–8 players.
- Verify every special two-player case.
- Verify Wild Draw Four legal play, bluff, accept, successful challenge, failed challenge, and pre-play-color legality.
- Verify last-card Draw Two and every last-card Wild Draw Four challenge outcome before scoring.
- Verify UNO declared, self-caught, opponent-caught, too-late catch, and catch-versus-next-action ordering.
- Verify draw-pile exhaustion preserves the top discard and retains all 108 unique cards.
- Verify multi-round cumulative scoring and finish thresholds at 250, 500, and 1,000.
- Verify stacking and other excluded house rules are rejected.

### Projection and realtime

- Assert each active viewer sees only their own hand and permitted actions.
- Assert challenge responses contain only the verdict and penalty, never evidence cards or the challenged hand.
- Assert round-results reveals are public and their point total matches the server score.
- Verify idempotent commands do not double-play, double-draw, double-penalize, or double-score.
- Verify simultaneous UNO catches serialize to one penalty.
- Verify reconnect during a normal turn, after drawing, during an UNO catch window, and during a challenge.
- Verify disconnect resolution after 60 seconds and rejection before the grace period.
- Verify eight-player invite capacity consistently across UNO, Boggle, and Farkle.
- Verify finalization retries write one set of score/history projections.

### UI, accessibility, and graphics

- Component-test setup choices, legal/illegal hand states, color selection, pass, UNO, catch, challenge, and round continuation.
- Test keyboard-only play and meaningful accessible labels for all 54 distinct card faces.
- Test color-independent recognition and high-contrast focus states.
- Test reduced-motion and WebGL-failure behavior.
- Visual-regression check desktop two-player, desktop eight-player, narrow mobile, a large hand, reverse direction, challenge, and round results.
- Verify animation deduplication on command acknowledgement, broadcast snapshot, refresh, and reconnect.
- Profile an eight-player table on a mid-range mobile device; cap pixel ratio and texture/material counts before reducing semantic UI quality.

## 9. Implementation sequence

### Phase 1 — Freeze rules and fixtures

- Turn the locked rules above into a compact rules table and known deck fixtures.
- Record every ambiguous edge case as a test expectation before UI work.
- Exit when the team can answer dealer, first-discard, two-player, UNO-window, challenge, and final-card questions without relying on client behavior.

### Phase 2 — Pure UNO domain

- Add manifest, settings/command schemas, deck helpers, types, and pure engine transitions.
- Build exhaustive unit coverage for invariants and edge cases.
- Exit when complete matches can be simulated from fixed shuffled decks without a browser or Durable Object.

### Phase 3 — Authoritative room and projections

- Integrate UNO initialization, dispatch, player-specific projection, disconnect recovery, finalization, and registry/API unions.
- Add privacy, idempotency, reconnect, eight-player, and persistence tests.
- Exit when multiple simulated viewers can play a complete match without any hidden-card leak.

### Phase 4 — Setup, lobby, and semantic play UI

- Add the setup route/form, game-aware lobby capacity/details, match routing, accessible hand, core controls, challenge flow, rules modal, and round results.
- Keep the public table functional as DOM before adding presentation effects.
- Exit when a keyboard-only two-player match can be completed with WebGL disabled.

### Phase 5 — Three.js table and motion

- Build the shared scene, texture/material cache, seats, piles, living color compass, and event-driven deal/play/effect animations.
- Add reduced-motion behavior, context-loss fallback, cleanup, responsive cameras, and performance checks.
- Exit when animations enhance but never gate authoritative state or input.

### Phase 6 — Platform polish and regression

- Promote UNO in the catalog, complete history/final-summary details, refine announcements and mobile behavior, and run the full repository suite.
- Execute visual, accessibility, privacy, reconnection, and eight-player acceptance passes.
- Exit when UNO meets the completion criteria and Boggle/Farkle have no behavioral regressions.

## 10. Risks and controls

| Risk | Control |
| --- | --- |
| Hidden hands leak through broad snapshots or challenge state | Project per viewer in the Durable Object and add serialized negative tests for every opponent card ID. |
| Wild Draw Four and UNO races produce inconsistent results | Serialize commands in one Durable Object, store explicit pending states, and test competing command order. |
| “Official rules” drifts into familiar house rules | Version the rules, link the Mattel source in the rules modal, and test that excluded variants are rejected. |
| Capacity labels or layouts drift from the game manifest | Drive capacity from the manifest and test lobby/table layouts at the full eight seats. |
| Three.js duplicates state or blocks input | Keep the engine/server authoritative and the semantic DOM complete; derive animation from projected snapshots only. |
| Large hands or many seats hurt mobile performance | Reuse geometry/textures, cap pixel ratio, render only public/visible card backs, compress card overlap from measured space, and keep horizontal access when a hand exceeds the safe compression floor. |
| Reconnect replays private or obsolete animation | Reconcile immediately to the latest snapshot and only animate new sequence transitions observed live. |
| Network disconnects stall a match | Use a 60-second grace period and resolve with legal draw/pass or penalty acceptance behavior. |

## 11. Definition of done

UNO is done when a private 2–8-player match can be played from dealer selection through one or more scored rounds to the configured target; all classic 108-card rules above are enforced by the server; every hidden-information boundary is verified; the three-dimensional presentation is compelling but optional; keyboard, mobile, reduced-motion, WebGL-fallback, disconnect, and reconnect flows work; final scores persist once; and the existing game suite remains green.
