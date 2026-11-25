<script setup lang="ts">
import { holdemFormatLabels, HOLDEM_RULES } from '#shared/games/texas-holdem/rules'
import type { HoldemAction, HoldemDecision } from '#shared/games/texas-holdem'
import type { HoldemMatchView } from '#shared/types/api'

const props = defineProps<{ match: HoldemMatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{ action: [decision: HoldemDecision] }>()
const view = computed(() => props.match.game.view)
const format = computed(() => props.match.game.settings.format)
const numberFormat = new Intl.NumberFormat('en-US')
const chips = (value: number) => numberFormat.format(value)
const name = (id: string) => props.match.members.find(member => member.id === id)?.displayName ?? 'Player'
const now = shallowRef(Date.now())
const raiseTo = shallowRef<number | string>('')
const viewer = computed(() => view.value.seats.find(seat => seat.memberId === props.match.viewerMemberId))
const others = computed(() => {
  const seats = view.value.seats
  const index = seats.findIndex(seat => seat.memberId === props.match.viewerMemberId)
  return [...seats.slice(index + 1), ...seats.slice(0, index)]
})
const slots = [[1], [0, 2], [0, 1, 2], [3, 0, 2, 4], [3, 0, 1, 2, 4], [5, 3, 0, 2, 4, 6], [5, 3, 0, 1, 2, 4, 6]]
const currentResult = computed(() => view.value.latestResult?.handNumber === view.value.handNumber ? view.value.latestResult : undefined)
const standings = computed(() => [...view.value.seats].sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0)))
const winners = computed(() => standings.value.filter(seat => seat.placement === 1).map(seat => name(seat.memberId)))
const turns = computed(() => {
  const deadline = view.value.turn?.deadline ?? view.value.nextDealAt
  return deadline === undefined ? 0 : Math.max(0, Math.ceil((deadline - now.value - props.serverOffset) / 1000))
})
const roundName = computed(() => ({
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River'
})[view.value.street ?? 'preflop'])
const statement = computed(() => {
  if (view.value.turn) return view.value.turn.memberId === props.match.viewerMemberId ? 'Your turn' : `${name(view.value.turn.memberId)} to act`
  if (view.value.nextDealAt !== undefined) return 'Next hand soon'
  return 'Table paused'
})
const wager = computed(() => view.value.actions?.wager)
const validAmount = computed(() => wager.value && Number.isSafeInteger(Number(raiseTo.value)) && Number(raiseTo.value) >= wager.value.min && Number(raiseTo.value) <= wager.value.max)

function showdown(memberId: string) {
  return currentResult.value?.showdown.find(player => player.memberId === memberId)
}

function submit(action: HoldemAction, amount?: number) {
  if (!view.value.turn || !view.value.actions || turns.value === 0) return
  emit('action', { action, amount, handNumber: view.value.handNumber, turnId: view.value.turn.id })
}

watch([() => view.value.handNumber, () => view.value.turn?.id], () => {
  raiseTo.value = wager.value?.min ?? ''
}, { immediate: true })

let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  clock = setInterval(() => {
    now.value = Date.now()
  }, 200)
})
onScopeDispose(() => clearInterval(clock))
</script>

<template>
  <section
    class="holdem-room"
    aria-labelledby="holdem-heading"
  >
    <header class="holdem-room__header">
      <div class="min-w-0">
        <h1 id="holdem-heading">
          {{ match.name }}
        </h1>
        <p>
          Texas Hold’em
          <span aria-hidden="true"> / </span>
          {{ holdemFormatLabels[format] }}
        </p>
      </div>
      <TexasHoldemRulesModal on-felt />
    </header>

    <div
      v-if="match.status === 'finished'"
      class="holdem-finish"
    >
      <div>
        <h2>{{ winners.join(' and ') }} {{ winners.length === 1 ? 'wins' : 'tie for first' }}</h2>
        <p>{{ view.completedHands }} {{ view.completedHands === 1 ? 'hand' : 'hands' }} played</p>
        <div class="mt-5 flex flex-wrap gap-2">
          <UButton
            to="/games/texas-holdem/new"
            icon="i-lucide-rotate-ccw"
          >
            Play again
          </UButton>
          <UButton
            to="/history"
            color="neutral"
            variant="soft"
            icon="i-lucide-history"
          >
            Match history
          </UButton>
        </div>
      </div>
      <ol
        class="holdem-finish__places"
        aria-label="Final standings"
      >
        <li
          v-for="seat in standings"
          :key="seat.memberId"
        >
          <strong class="holdem-number">#{{ seat.placement }}</strong>
          <span>{{ name(seat.memberId) }}</span>
          <span class="holdem-number">{{ chips(seat.stack) }} chips</span>
        </li>
      </ol>
    </div>

    <template v-else>
      <div class="holdem-room__status">
        <span>Hand <strong class="holdem-number">{{ view.handNumber }}{{ format === 'fixed-hands' ? ' / ' + HOLDEM_RULES.fixedHands : '' }}</strong></span>
        <span v-if="format === 'tournament'"><strong>{{ view.seats.filter(seat => seat.status !== 'out').length }}</strong> remaining</span>
        <span>Blinds <strong class="holdem-number">{{ chips(view.blinds.small) }} / {{ chips(view.blinds.big) }}</strong></span>
        <span v-if="view.blinds.handsUntilIncrease === 0">Blinds rise next hand</span>
        <span v-else-if="view.blinds.handsUntilIncrease">Blinds rise in {{ view.blinds.handsUntilIncrease }} {{ view.blinds.handsUntilIncrease === 1 ? 'hand' : 'hands' }}</span>
        <span
          v-if="!connected"
          class="holdem-room__reconnect"
        ><UIcon
          name="i-lucide-wifi-off"
          aria-hidden="true"
        /> Reconnecting</span>
      </div>

      <div class="holdem-felt">
        <div
          class="holdem-felt__stitch"
          aria-hidden="true"
        />
        <div
          v-for="(seat, index) in others"
          :key="seat.memberId"
          class="holdem-seat"
          :class="[
            'holdem-seat--' + (slots[others.length - 1]?.[index] ?? index),
            { 'holdem-seat--active': view.turn?.memberId === seat.memberId, 'holdem-seat--out': seat.status === 'out' || seat.status === 'folded' }
          ]"
        >
          <div class="holdem-seat__identity">
            <strong :title="name(seat.memberId)">{{ name(seat.memberId) }}</strong>
            <span class="holdem-seat__markers">
              <abbr
                v-if="seat.button"
                title="Dealer"
                class="dealer-mark"
              >D</abbr>
              <abbr
                v-if="seat.smallBlind"
                title="Small blind"
              >SB</abbr>
              <abbr
                v-if="seat.bigBlind"
                title="Big blind"
              >BB</abbr>
            </span>
          </div>
          <div class="holdem-seat__summary">
            <span class="holdem-number">{{ chips(seat.stack) }}</span>
            <span v-if="seat.status === 'folded'">Folded</span>
            <span v-else-if="seat.status === 'all-in'">All-in</span>
            <span v-else-if="seat.placement">#{{ seat.placement }}</span>
            <span v-else-if="seat.status === 'out'">Out</span>
            <span v-if="seat.commitment">Bet {{ chips(seat.commitment) }}</span>
            <span v-if="seat.status === 'playing' && !match.members.find(member => member.id === seat.memberId)?.connected">Away</span>
          </div>
          <div
            v-if="showdown(seat.memberId)"
            class="holdem-seat__cards"
          >
            <TexasHoldemCard
              v-for="card in showdown(seat.memberId)?.cards"
              :key="card"
              :value="card"
            />
            <span>{{ showdown(seat.memberId)?.label }}</span>
          </div>
        </div>

        <div class="holdem-board">
          <div class="holdem-board__heading">
            <span>{{ view.turn ? roundName : 'Hand complete' }}</span>
            <span
              v-if="view.pots.length"
              class="holdem-board__pot"
            ><span>Pot</span> <strong class="holdem-number">{{ chips(view.pots[0]!) }}</strong></span>
            <span
              v-else-if="currentResult?.awards.length"
              class="holdem-board__pot"
            ><span>Paid</span> <strong class="holdem-number">{{ chips(currentResult.awards.reduce((sum, pot) => sum + pot.amount, 0)) }}</strong></span>
          </div>
          <div
            class="holdem-board__cards"
            aria-label="Community cards"
          >
            <TexasHoldemCard
              v-for="(card, index) in view.board"
              :key="`${view.handNumber}-${card}`"
              :value="card"
              :style="{ '--deal-delay': Math.max(0, index < 3 ? index * 30 : 0) + 'ms' }"
              class="holdem-board__dealt"
            />
            <TexasHoldemCard
              v-for="placeholder in 5 - view.board.length"
              :key="'empty-' + placeholder"
              empty
            />
          </div>
          <p
            v-if="view.pots.length > 1"
            class="holdem-board__sides"
          >
            Side pots {{ view.pots.slice(1).map(chips).join(' / ') }}
          </p>
          <p
            v-else-if="currentResult"
            class="holdem-board__sides"
          >
            {{ [...new Set(currentResult.awards.flatMap(award => award.payouts.map(payout => name(payout.memberId))))].join(' · ') }}
          </p>
        </div>
      </div>

      <div class="holdem-dock">
        <div class="holdem-pocket">
          <div
            v-if="view.cards.length"
            class="holdem-pocket__cards"
            aria-label="Your cards"
          >
            <TexasHoldemCard
              v-for="card in view.cards"
              :key="card"
              :value="card"
              :featured="showdown(match.viewerMemberId)?.bestFive.includes(card)"
            />
          </div>
          <div
            v-else
            class="holdem-pocket__cards"
            aria-hidden="true"
          >
            <TexasHoldemCard empty />
            <TexasHoldemCard empty />
          </div>
          <div class="min-w-0">
            <div class="holdem-pocket__title">
              <strong :title="name(match.viewerMemberId)">{{ name(match.viewerMemberId) }}</strong>
              <abbr
                v-if="viewer?.button"
                class="dealer-mark"
                title="Dealer"
              >D</abbr>
              <abbr
                v-if="viewer?.smallBlind"
                title="Small blind"
              >SB</abbr>
              <abbr
                v-if="viewer?.bigBlind"
                title="Big blind"
              >BB</abbr>
            </div>
            <p><strong class="holdem-number">{{ chips(viewer?.stack ?? 0) }}</strong> chips</p>
            <p v-if="viewer?.status === 'out'">
              Out of play
            </p>
            <p v-else-if="viewer?.status === 'folded'">
              Folded
            </p>
            <p v-else-if="viewer?.status === 'all-in'">
              All-in
            </p>
            <p v-else-if="viewer?.commitment">
              Bet {{ chips(viewer.commitment) }}
            </p>
            <p v-else-if="showdown(match.viewerMemberId)">
              {{ showdown(match.viewerMemberId)?.label }}
            </p>
          </div>
        </div>

        <div class="holdem-actions">
          <div class="holdem-actions__status">
            <strong role="status">{{ statement }}</strong>
            <span
              v-if="view.turn || view.nextDealAt"
              class="holdem-number"
            >{{ turns }}s</span>
          </div>
          <div
            v-if="view.actions"
            class="holdem-actions__buttons"
          >
            <button
              type="button"
              :disabled="!turns"
              @click="submit('fold')"
            >
              Fold
            </button>
            <button
              v-if="view.actions.check"
              type="button"
              :disabled="!turns"
              class="holdem-action--primary"
              @click="submit('check')"
            >
              Check
            </button>
            <button
              v-else
              type="button"
              :disabled="!turns"
              class="holdem-action--primary"
              @click="submit('call')"
            >
              Call {{ chips(view.actions.call) }}
            </button>
            <button
              v-if="view.actions.allIn"
              type="button"
              :disabled="!turns"
              @click="submit('all-in')"
            >
              All-in
            </button>
          </div>
          <form
            v-if="wager"
            class="holdem-actions__wager"
            @submit.prevent="submit(wager.action, Number(raiseTo))"
          >
            <label>
              <span>{{ wager.action === 'bet' ? 'Bet amount' : 'Raise to' }} <small>{{ chips(wager.min) }}–{{ chips(wager.max) }}</small></span>
              <input
                v-model.number="raiseTo"
                type="number"
                :min="wager.min"
                :max="wager.max"
                step="1"
                inputmode="numeric"
                required
                :disabled="!turns"
              >
            </label>
            <button
              type="submit"
              :disabled="!validAmount || !turns"
            >
              {{ wager.action === 'bet' ? 'Bet' : 'Raise' }}
            </button>
          </form>
        </div>
      </div>
    </template>

    <details
      v-if="view.latestResult"
      class="holdem-settlement"
      :open="!view.turn"
    >
      <summary>Hand {{ view.latestResult.handNumber }} result</summary>
      <div
        v-if="view.latestResult.board.length"
        class="holdem-settlement__board"
        aria-label="Final board"
      >
        <span>Board</span>
        <TexasHoldemCard
          v-for="card in view.latestResult.board"
          :key="card"
          :value="card"
        />
      </div>
      <div class="holdem-settlement__body">
        <ul aria-label="Payouts">
          <li
            v-for="(award, index) in view.latestResult.awards"
            :key="index"
          >
            <strong>{{ index === 0 ? 'Main pot' : 'Side pot ' + index }}</strong>
            <span>{{ award.payouts.map(payout => name(payout.memberId) + ' +' + chips(payout.chips)).join(' · ') }}</span>
          </li>
          <li
            v-for="refund in view.latestResult.refunds"
            :key="refund.memberId"
          >
            <strong>Returned</strong>
            <span>{{ name(refund.memberId) }} +{{ chips(refund.chips) }}</span>
          </li>
        </ul>
        <ul
          v-if="view.latestResult.showdown.length"
          aria-label="Showdown hands"
        >
          <li
            v-for="player in view.latestResult.showdown"
            :key="player.memberId"
          >
            <strong>{{ name(player.memberId) }}</strong>
            <span>{{ player.label }}</span>
            <span class="holdem-settlement__cards">
              <TexasHoldemCard
                v-for="card in player.cards"
                :key="card"
                :value="card"
                :featured="player.bestFive.includes(card)"
              />
            </span>
          </li>
        </ul>
      </div>
    </details>
  </section>
</template>

<style scoped>
.holdem-room {
  --ink: #f9edd7;
  --muted: #c7d9d2;
  --gold: #f6ca82;
  padding: clamp(1rem, 2vw, 1.35rem);
  border-radius: 16px;
  color: var(--ink);
  background: #152d38;
}
.holdem-room__header, .holdem-room__status { display: flex; align-items: center; gap: 0.65rem 1.2rem; flex-wrap: wrap; }
.holdem-room__header { justify-content: space-between; padding-bottom: 0.85rem; }
.holdem-room__header h1, .holdem-finish h2 {
  font: 780 clamp(1.65rem, 4.5vw, 2.5rem)/1.08 var(--font-display);
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}
.holdem-room__header p, .holdem-finish p { margin-top: 0.26rem; color: var(--muted); font-size: 0.86rem; }
.holdem-room__status { padding: 0.75rem 0; border-top: 1px solid #adc6cc38; color: var(--muted); font-size: 0.8rem; }
.holdem-room__status strong { color: var(--ink); }
.holdem-room__reconnect { display: inline-flex; align-items: center; gap: 0.28rem; color: var(--gold); }
.holdem-number { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.holdem-felt {
  isolation: isolate;
  position: relative;
  display: grid;
  grid-template: auto 1fr auto / repeat(5, minmax(0, 1fr));
  align-items: center;
  gap: 0.75rem;
  min-height: 18.5rem;
  padding: clamp(0.75rem, 2.6vw, 1.8rem);
  border: 1px solid #547969;
  border-radius: 4rem;
  background: radial-gradient(ellipse at 51% 42%, #2c6151, #1a413e 72%, #16383b);
}
.holdem-felt__stitch {
  position: absolute;
  z-index: -1;
  inset: 0.55rem;
  border: 1px solid #d6bb8878;
  border-radius: 3.55rem;
  pointer-events: none;
}
.holdem-board {
  --holdem-card-size: clamp(2.25rem, 5.25vw, 4.85rem);
  --holdem-card-type: clamp(0.7rem, 1.55vw, 1.15rem);
  grid-area: 2 / 2 / 3 / 5;
  display: grid;
  justify-items: center;
  align-content: center;
  min-width: 0;
}
.holdem-board__heading { display: flex; align-items: center; gap: 0.6rem 1rem; flex-wrap: wrap; justify-content: center; color: var(--muted); font-size: 0.9rem; }
.holdem-board__pot { display: inline-flex; gap: 0.42rem; align-items: baseline; color: var(--gold); }
.holdem-board__pot strong { font-size: 1.35rem; }
.holdem-board__cards { display: flex; gap: clamp(0.22rem, 0.8vw, 0.75rem); margin-top: 0.48rem; }
.holdem-board__sides { margin-top: 0.65rem; text-align: center; font-size: 0.8rem; }
.holdem-board__dealt { animation: holdem-deal 270ms cubic-bezier(0.2, 1, 0.32, 1) var(--deal-delay) both; }
@keyframes holdem-deal {
  from { transform: translateY(-0.45rem); clip-path: inset(0 0 18% 0 round 0.42em); }
  to { transform: translateY(0); clip-path: inset(-12% -12% -12% -12%); }
}

.holdem-seat {
  min-width: 0;
  padding: 0.44rem 0.6rem;
  border: 1px solid #bdd7c65c;
  border-radius: 12px;
  background: #143633;
}
.holdem-seat--0 { grid-area: 1 / 2; }
.holdem-seat--1 { grid-area: 1 / 3; }
.holdem-seat--2 { grid-area: 1 / 4; }
.holdem-seat--3 { grid-area: 2 / 1; }
.holdem-seat--4 { grid-area: 2 / 5; }
.holdem-seat--5 { grid-area: 3 / 2; }
.holdem-seat--6 { grid-area: 3 / 4; }
.holdem-seat--active { border-color: var(--gold); background: #294948; }
.holdem-seat--out { color: #d1dfd8; background: #1b3738; }
.holdem-seat__identity, .holdem-pocket__title { display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; font-size: 0.85rem; }
.holdem-seat__identity strong, .holdem-pocket__title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.holdem-seat__markers { display: flex; align-items: center; gap: 0.18rem; flex-shrink: 0; }
.holdem-seat__markers abbr, .holdem-pocket__title abbr { text-decoration: none; font: 700 0.62rem var(--font-mono); color: var(--muted); }
.holdem-seat__markers .dealer-mark, .holdem-pocket__title .dealer-mark {
  display: grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  color: #222a2c;
  background: var(--gold);
}
.holdem-seat__summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.12rem 0.45rem; margin-top: 0.22rem; color: var(--muted); font-size: 0.7rem; }
.holdem-seat__summary .holdem-number { color: var(--ink); font-weight: 700; }
.holdem-seat__cards, .holdem-settlement__cards { --holdem-card-size: 1.25rem; --holdem-card-type: 0.43rem; display: flex; align-items: center; gap: 0.3rem; }
.holdem-seat__cards { margin-top: 0.38rem; color: var(--muted); font-size: 0.68rem; }

.holdem-dock { display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(12rem, 2fr); gap: 0.75rem 1.4rem; margin-top: 0.9rem; }
.holdem-pocket, .holdem-actions { border: 1px solid #aec8ce4b; border-radius: 12px; background: #203b48; padding: 0.85rem; }
.holdem-pocket { display: flex; align-items: center; gap: 0.85rem; }
.holdem-pocket__cards { --holdem-card-size: 2.45rem; --holdem-card-type: 0.7rem; display: flex; gap: 0.38rem; }
.holdem-pocket__title { justify-content: flex-start; }
.holdem-pocket p { font-size: 0.79rem; color: var(--muted); margin-top: 0.24rem; }
.holdem-actions__status { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; line-height: 1.1; font-size: 0.95rem; overflow-wrap: anywhere; }
.holdem-actions__status span { color: var(--gold); font-size: 0.8rem; }
.holdem-actions__buttons { display: flex; flex-wrap: wrap; gap: 0.44rem; margin-top: 0.6rem; }
.holdem-actions button {
  min-height: 2.3rem;
  padding: 0.28rem 0.75rem;
  border: 1px solid #c7d9d28c;
  border-radius: 0.45rem;
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}
.holdem-actions button:hover:enabled { background: #345665; }
.holdem-actions button:disabled, .holdem-actions input:disabled { cursor: default; opacity: 0.55; }
.holdem-actions .holdem-action--primary, .holdem-actions .holdem-action--primary:hover:enabled {
  background: var(--gold);
  border-color: var(--gold);
  color: #203035;
}
.holdem-actions .holdem-action--primary:hover:enabled { filter: brightness(1.06); }
.holdem-room :is(button, input, summary):focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.holdem-actions__wager { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: end; margin-top: 0.65rem; }
.holdem-actions__wager label { display: grid; gap: 0.2rem; font-size: 0.79rem; }
.holdem-actions__wager small { color: var(--muted); font-size: 0.72rem; margin-left: 0.3rem; }
.holdem-actions__wager input { min-height: 2.3rem; width: 8rem; padding: 0.15rem 0.48rem; border: 1px solid #c7d9d28c; border-radius: 0.45rem; background: #142d3b; color: var(--ink); color-scheme: dark; caret-color: var(--gold); font-family: var(--font-mono); }

.holdem-settlement { margin-top: 0.85rem; padding: 0.55rem 0; border-block: 1px solid #aec8ce4b; font-size: 0.85rem; }
.holdem-settlement summary { width: fit-content; cursor: pointer; color: var(--gold); font-weight: 700; }
.holdem-settlement__board { --holdem-card-size: 1.55rem; --holdem-card-type: 0.48rem; display: flex; align-items: center; gap: 0.3rem; margin-block: 0.6rem 0.15rem; }
.holdem-settlement__board span:first-child { margin-right: 0.25rem; }
.holdem-settlement__body { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); gap: 0.55rem 1.2rem; padding-top: 0.4rem; }
.holdem-settlement__body li { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 0.65rem; padding-top: 0.3rem; color: var(--muted); }
.holdem-settlement__body strong { color: var(--ink); overflow-wrap: anywhere; }

.holdem-finish { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; padding-block: 1.1rem; border-top: 1px solid #aec8ce4b; }
.holdem-finish__places li { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 0.8rem; border-bottom: 1px solid #aec8ce4b; padding: 0.65rem 0; overflow-wrap: anywhere; font-size: 0.85rem; }
.holdem-finish__places strong { color: var(--gold); }

@media (min-width: 900px) {
  .holdem-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; column-gap: 1rem; }
  .holdem-actions__status { grid-column: 1 / -1; align-self: start; }
}

@media (max-width: 840px) {
  .holdem-felt { gap: 0.42rem; border-radius: 1.5rem; padding: 0.9rem; }
  .holdem-felt__stitch { border-radius: 1.07rem; inset: 0.35rem; }
  .holdem-seat { padding: 0.32rem 0.38rem; }
}

@media (max-width: 650px) {
  .holdem-felt { grid-template: auto / repeat(3, minmax(0, 1fr)); min-height: auto; }
  .holdem-board { grid-area: auto / 1 / auto / -1; order: -1; padding-block: 0.6rem 0.75rem; }
  .holdem-seat { grid-area: auto; }
  .holdem-dock, .holdem-finish { grid-template-columns: 1fr; }
  .holdem-pocket, .holdem-actions { padding: 0.62rem; }
  .holdem-actions button, .holdem-actions__wager input { min-height: 2.75rem; }
}

@media (max-width: 359px) {
  .holdem-felt { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .holdem-board__dealt { animation: none; }
}
</style>
