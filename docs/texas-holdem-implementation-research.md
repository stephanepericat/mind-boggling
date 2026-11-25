# Texas Hold’em implementation research

Researched November 25, 2026.

## Recommendation

Add a private No-Limit Texas Hold’em game for 2–8 players using the same lobby, invites, chat, and match history as the other Mind Boggling games. Let the host choose **12 Hands** or **Tournament** during setup. Every player starts each match with a fresh stack of free play chips. Both formats share the same dealing, betting, and payout engine.

## Match format and first-release defaults

| Setup option | Blinds | Finish and standings |
| --- | --- | --- |
| **12 Hands** | Fixed throughout the match. | Finish after 12 settled hands or when only one player has chips, whichever comes first. Rank by final stack and share places for equal stacks. |
| **Tournament** | Increase between hands on a schedule shown at the table. | Finish when one player has chips. Players who survive longer place higher. For simultaneous eliminations, place the larger pre-hand stack higher and share places for equal pre-hand stacks. |

Tournament blind increases and elimination-based standings distinguish the longer format. For the first playtest, try doubling the blinds after every four settled hands, beginning at 5/10 and capping the big blind at the total chips issued for the match. Advance the level before the next deal so a paused table keeps its current level. The schedule and same-hand placement rule are proposals. [World Poker Federation on tournament structure](https://worldpokerfederation.org/poker/how-to-play-poker/variants-and-rules/how-to-play-texas-holdem/) · [Poker TDA Rule 25](https://www.pokertda.com/view-poker-tda-rules/) · [WSOP tournament rules, Rule 126(b)](https://wsop.gg-global-cdn.com/wsop/pdfs/2026-WSOP-Tournament-Rules.pdf#page=27)

| Shared setting | First-release behavior |
| --- | --- |
| Seats | 2–8 seated members. Lock seats when the host starts the match. Anyone who runs out of chips is out of play for that match and can stay at the table to watch. |
| Chips | Give every player a fresh stack of free, table-local chips when the match starts. Use 1,000 chips per seat and opening blinds of 5/10 for the first playtest. Use whole chips. |
| Pace | Start playtesting with 25 seconds per decision and a short, automatic break after settlement. At timeout, check if legal and fold if facing a wager. |
| History | Save the format, hands completed, and each player’s final stack and placement. Keep the most recent hand result available at the table so players can review a payout after the next deal. |

Randomize the initial button in both formats. A 12-hand cap can give some seats one more turn in a given blind position. Randomizing the button distributes that difference across matches.

## Rules the engine needs to enforce

### Deal and order of play

- Use one standard 52-card deck per hand. Deal two private cards to every funded seat. Burn one card before each board street, then deal three cards on the flop, one on the turn, and one on the river. If everyone but one player folds, award the pot immediately and keep all undealt cards private. [World Poker Federation](https://worldpokerfederation.org/poker/how-to-play-poker/variants-and-rules/how-to-play-texas-holdem/)
- With three or more players, action starts left of the big blind preflop and at the first seat still able to act clockwise from the button after the flop. If the preflop action comes back unraised, the big blind can check or raise. Heads-up, the button posts the small blind and acts first preflop. The big blind acts first after the flop. Include a fixture for the transition from three seats to two so the same player does not post consecutive big blinds when heads-up begins. [World Poker Federation](https://worldpokerfederation.org/poker/how-to-play-poker/variants-and-rules/how-to-play-texas-holdem/) · [Poker TDA Rule 36](https://www.pokertda.com/view-poker-tda-rules/)
- Keep seat order fixed after a bust and use the same button and blind rotation in both formats. Follow the Poker TDA dead-button procedure while three or more players remain, preserving the big blind rotation even when the button lands at an empty seat. Switch to the heads-up rule when two players remain. [Poker TDA Rules 34 and 36](https://www.pokertda.com/view-poker-tda-rules/)

### Betting

- The server derives when a player can check, call, fold, bet, raise, or go all-in. Represent a bet or raise using the player’s **total commitment on this street**, and show the additional chips it costs separately. Calls are capped by the player’s remaining stack. The big blind sets the minimum opening bet and preflop bring-in. A short blind posts what it can, with the normal bring-in still applying when multiple funded players can contest it. [World Poker Federation](https://worldpokerfederation.org/poker/how-to-play-poker/variants-and-rules/how-to-play-texas-holdem/) · [Robert’s Rules of Poker, Blinds and No-Limit](https://www.briggsoft.com/docs/pmavens/Rules_Roberts.htm)
- Track the current wager, the size of the last full bet or raise, and the wager each seat last acted against. A short all-in can increase the price to call while leaving some players unable to raise. If A bets 100, B calls, and C goes all-in for 140, A and B can call or fold when action returns at 140. If D goes all-in for 200 before action returns, the combined 100-chip increase reopens action for A and B, and a full raise goes to at least 300. An all-in above the call amount still requires the right to raise. [Poker TDA Rules 45 and 49](https://www.pokertda.com/view-poker-tda-rules/)
- Close a street once everyone still able to act has answered the current wager and had their opportunity to act. If nobody can bet against a funded opponent, resolve any outstanding call or fold first. Then run out the remaining board when two or more players are still live. [Poker TDA Rule 17 and illustration addendum](https://www.pokertda.com/view-poker-tda-rules/)

### Showdown and chip settlement

- Compare each eligible player’s best five cards from the seven available. A player can use zero, one, or two hole cards. Compare the category and its tie-break ranks, including kickers and the ace-low straight. Equal ranks split the pot regardless of suits. For the digital table, automatically reveal all live hands at a contested showdown. If all further betting is closed before the river, reveal the live hands for the runout. Keep folded cards private and award a fold win without revealing the winner’s cards. [World Poker Federation](https://worldpokerfederation.org/poker/how-to-play-poker/variants-and-rules/how-to-play-texas-holdem/) · [Poker TDA Rules 16–20](https://www.pokertda.com/view-poker-tda-rules/)
- Build pots from total hand contributions in ascending chip tiers. Include folded contributions in each tier’s value and exclude folded seats from eligibility. Return any unmatched excess to its contributor. Evaluate and split the main pot and every side pot independently. Give any remainder chips to tied winners in clockwise order starting left of the button. [Poker TDA Rules 21 and 23](https://www.pokertda.com/view-poker-tda-rules/) · [PokerStars poker rules](https://www.pokerstars.com/poker/games/rules/)
- Suppose A commits 25, B 60, C 80, and D 10 before folding. The main pot is 85 and A, B, and C can win it. A 70-chip side pot is contested by B and C. C gets 20 back as an uncalled wager. If A has the best hand and B has the next best, A wins 85 and B wins 70. The payout and refund account for all 175 committed chips.

## Fit with the current code

The shared game contract describes a generic engine, but the registry currently stores manifests and the runtime dispatches explicitly by game key. UNO is the closest example for private cards. Its player projection constructs the viewer’s own hand and gives other seats public card counts. Poker can follow the same pattern with its own types, engine, and projection. [Game contract](../shared/games/contract.ts) · [Game registry](../shared/games/registry.ts) · [Room projections](../workers/match-room/src/projection.ts)

| Integration point | Work for Hold’em |
| --- | --- |
| Match creation and joining | Add a proposed `texas-holdem.v1` key, `texas-holdem` slug, manifest, and settings schema. Validate and persist `format` as `fixed-hands` or `tournament` at creation. The invite code already reads `manifest.maxPlayers` and D1 enforces an eight-seat ceiling. Starting a match revokes invites. [Create endpoint](../server/api/matches/index.post.ts) · [Match utilities](../server/utils/matches.ts) · [D1 seat limit](../migrations/0002_match_member_limit.sql) |
| Room state and commands | Add a poker branch to persisted room decoding, initialization, start, command parsing and dispatch, and finalization. Add poker variants to the shared command and `MatchView` unions. Several current fallbacks assume UNO after checking other game keys, so make those branches explicit when adding poker. [Room implementation](../workers/match-room/src/index.ts) · [Room types](../workers/match-room/src/types.ts) · [Platform commands](../shared/platform/commands.ts) · [API types](../shared/types/api.ts) |
| Table and setup | Add `/games/texas-holdem/new` with **12 Hands** and **Tournament** choices. Show the selected format and its finish condition in the lobby. Add a poker table branch in the room and poker-specific artwork in the catalog. [Catalog](../app/components/catalog/GameCatalog.vue) · [Lobby](../app/components/match/Lobby.vue) · [Room UI](../app/components/match/Room.vue) |
| Final results and history | Store final stack in the existing integer score field and write the engine’s placement explicitly. The current finalizer ranks by score, which would group all busted tournament players together. Have the results UI render the engine’s placements, including ties. Read the format from match settings for history and store hands completed in the score projection payload. [Room finalizer](../workers/match-room/src/index.ts) · [D1 schema](../migrations/0001_platform.sql) · [History query](../server/utils/matches.ts) · [Final results](../app/components/match/FinalResults.vue) · [Scoreboard](../app/components/match/Scoreboard.vue) · [History list](../app/components/history/HistoryList.vue) |
| All-time rankings | Keep poker in participant history. Omit it from the all-time leaderboard’s options and enforce the exclusion in the API. The current query ranks raw scores across matches, so larger tables make higher peak stacks possible and other signed-in platform users can see the ranked results. [Leaderboard endpoint](../server/api/leaderboard.get.ts) · [Leaderboard query](../server/utils/leaderboard.ts) |

### Authoritative state and reconnects

Use a pure TypeScript engine in `shared/games/texas-holdem/`. Persist stable seats, stacks, blind positions, hand and turn IDs, the active street and deadline, private cards and deck cursor, per-street and per-hand contributions, folded and all-in status, and the public hand result in the existing per-match Durable Object. Draw the deck with the existing Worker `WebCryptoRandomSource` and shared Fisher–Yates shuffle, which uses rejection sampling to avoid modulo bias. Supply a fixed deck in tests. Persist each new deck once alongside the hand so a restart or retried command resumes the same deal. [Shared shuffle](../shared/random/shuffle.ts) · [Uniform sampling](../shared/random/uniform.ts) · [Worker random source](../workers/match-room/src/random.ts) · [Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

At hand start, persist the opening stacks and the blinds used for that hand. After settlement, use the format in match settings to calculate the next blind level or final standings. In Tournament mode, record each elimination once, including the player’s pre-hand stack and placement. Resolve chips before deciding who busted, since an all-in player can recover chips through a pot award or refund.

Accept commands through the existing HTTP and WebSocket paths. Derive the actor from authenticated membership and require a current hand ID, turn ID, and idempotency key. Validate timing, turn ownership and wager bounds from the latest stored state. Commit the state change and processed key in one local transaction before acknowledging or broadcasting. Keep external D1 work outside the chip transition and use the existing finalization outbox for retryable history delivery. Persist the same result and completion time for every retry. The current room performs the deduplication write and snapshot write separately and awaits dispatch before committing, so explicitly cover rapid commands across two tabs and HTTP fallback. [Room implementation](../workers/match-room/src/index.ts) · [HTTP command gateway](../server/api/matches/%5Bid%5D/command.post.ts) · [WebSocket gateway](../server/api/matches/%5Bid%5D/socket.get.ts) · [Cloudflare SQLite-backed storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

Give each decision a server deadline. Reconnecting keeps the same seat and remaining time. Set the room’s single alarm for the next turn expiry, deal, or finalization retry. Read current state when it fires and apply a timeout only if the stored turn is still current and due. When processing a command at or after the deadline, apply the timeout even if the alarm is delayed. Reuse `active` during hands and hand results, then move to `finished` after the final settlement. When everyone is away, finish the current hand and pause between hands until a participant returns. [Room alarms](../workers/match-room/src/index.ts) · [Cloudflare alarms](https://developers.cloudflare.com/durable-objects/api/alarms/) · [Cloudflare WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

Build the participant view from an explicit set of fields. Send the board, visible bets and stacks, active seat, deadline, and permitted showdown cards to all seated members. Send legal actions and bounds only to the acting player, and private hole cards only to their owner. Apply the same rules to initial HTTP load, reconnect, WebSocket updates, and hand results. Keep deck order, burn cards, unrevealed hole cards and private state out of logs, errors, and D1 summaries. Ignore snapshots older than the current sequence so an HTTP response can’t restore expired actions after a newer socket update. [Room projections](../workers/match-room/src/projection.ts) · [Realtime client](../app/composables/useMatchRealtime.ts) · [UNO projection tests](../tests/uno-projection.test.ts)

### Hand evaluator options

| Option | Fit |
| --- | --- |
| Small TypeScript evaluator | Evaluate the 21 five-card combinations in seven cards and compare rank tuples. At eight seats that is at most 168 five-card evaluations per showdown, even with several side pots, because each hand is ranked once. This is the recommended starting point. Return the best five cards as well as the rank for result highlighting. |
| `pokersolver` | MIT-licensed JavaScript with standard poker hand comparison and tied winners. A candidate for cross-checking fixtures or as a production dependency if its Worker bundle and behavior are verified. [Project repository](https://github.com/goldfire/pokersolver) |
| `phe` | MIT-licensed lookup-based evaluator for five to seven cards. It returns a numeric strength, with lower values stronger. A fit if future bot or equity calculations need higher evaluation throughput. The table would still need to identify the five cards to highlight. [Project repository](https://github.com/thlorenz/phe) |

Library interfaces and licenses were reviewed from their public repositories. Worker compatibility and performance still need a runtime check if a dependency is selected.

## Table experience

- Show the board, total and side pots, each seat’s stack and current bet, the dealer and blind markers, and whose turn it is. Keep the current player’s cards and actions in the same place across streets. Mark folded, all-in, disconnected, and busted seats with text or icons as well as color.
- Show the current hand out of 12 in **12 Hands**. In **Tournament**, show the remaining player count, the current blinds, and when they rise.
- Make check and call amounts explicit, and show the minimum and maximum on the raise control. Support keyboard entry and provide an explicit submit button for a wager. Update the controls from the authoritative snapshot after the action lands. Let screen readers identify rank and suit and announce changes in turn and outcome without reading every timer tick.
- At the end of each hand, show who won each pot, how many chips were paid or returned, and the public winning hand if cards were shown. Keep dealing and chip movement as presentation so play is understandable with reduced motion or animations disabled.

## Implementation and verification order

1. **Engine and fixtures.** Cover deck uniqueness, hand rankings and kickers, playing the board, the big-blind option, short blinds, heads-up rotation, short all-ins, side pots, folded chips, refunds, and odd chips. Check chip conservation and nonnegative stacks after every transition. Also cover the 12th-hand finish with multiple funded seats, early finish in both modes, a tournament level change between hands, and simultaneous tournament eliminations with equal and unequal opening stacks. [Poker TDA illustration addendum](https://www.pokertda.com/view-poker-tda-rules/)
2. **Room and privacy.** Exercise duplicate and stale actions, an action racing a timeout, room restart during a hand and between hands, multiple sockets, and D1 finalization retry. Compare serialized HTTP and WebSocket views for every seat before and after showdown, including a busted seat and a reconnected player. Verify that a nonmember cannot fetch a snapshot or connect.
3. **Private playtest.** Run both setup options through creation, invitation, play, final standings, history, and play again. Confirm fresh stacks on replay and check two-, three-, and eight-seat layouts. Include a three-to-two transition, an unattended timeout, and a tied finish. Test keyboard controls and narrow layouts. Use the playtest to tune the opening stack, tournament blind schedule, and action clock.
