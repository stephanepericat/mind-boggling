<script setup lang="ts">
import { cardLabel } from '#shared/games/uno'
import type { UnoCard, UnoColor, UnoCommand } from '#shared/games/uno'
import type { UnoMatchView } from '../../../shared/types/api'

type WithoutIdempotency<T> = T extends { idempotencyKey: string } ? Omit<T, 'idempotencyKey'> : never
type UnoUiCommand = WithoutIdempotency<UnoCommand>

const props = defineProps<{ match: UnoMatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{ command: [command: UnoUiCommand] }>()

const rulesOpen = shallowRef(false)
const unoArmed = shallowRef(false)
const pendingWildCard = shallowRef<UnoCard | null>(null)
const now = shallowRef(Date.now() + props.serverOffset)
let clock: ReturnType<typeof setInterval> | null = null

const view = computed(() => props.match.game.view)
const viewer = computed(() => props.match.members.find(member => member.id === props.match.viewerMemberId))
const activeMember = computed(() => props.match.members.find(member => member.id === view.value.activeMemberId))
const dealer = computed(() => props.match.members.find(member => member.id === view.value.dealerMemberId))
const opponents = computed(() => view.value.turnOrder
  .filter(memberId => memberId !== props.match.viewerMemberId)
  .map(memberId => ({
    member: props.match.members.find(member => member.id === memberId),
    cardCount: view.value.opponents.find(opponent => opponent.memberId === memberId)?.cardCount ?? 0
  })))
const activeOpponentIndex = computed(() => opponents.value.findIndex(opponent => opponent.member?.id === view.value.activeMemberId))
const playable = computed(() => new Set(view.value.playableCardIds))
const actionKey = computed(() => `${props.match.sequence}:${view.value.lastAction?.type ?? 'deal'}:${view.value.topCard?.id ?? 'none'}`)
const activeColorLabel = computed(() => view.value.activeColor ? `${view.value.activeColor[0]!.toUpperCase()}${view.value.activeColor.slice(1)}` : 'Choose color')
const announcement = computed(() => {
  const action = view.value.lastAction
  if (!action) return `Round ${view.value.roundNumber}. ${dealer.value?.displayName ?? 'A player'} deals.`
  if (action.type === 'played') return `${memberName(action.memberId)} played ${cardLabel(action.card)}${action.chosenColor ? ` and chose ${action.chosenColor}` : ''}${action.calledUno ? ' and called UNO' : ''}.`
  if (action.type === 'drew') return `${memberName(action.memberId)} drew ${action.count} card${action.count === 1 ? '' : 's'}.`
  if (action.type === 'color-chosen') return `${memberName(action.memberId)} chose ${action.color}.`
  if (action.type === 'uno-called') return `${memberName(action.memberId)} called UNO.`
  if (action.type === 'uno-caught') return `${memberName(action.caughtByMemberId)} caught ${memberName(action.memberId)} without UNO.`
  if (action.type === 'challenge') return `Challenge ${action.verdict}. ${memberName(action.verdict === 'legal' ? action.challengedByMemberId : action.playedByMemberId)} draws ${action.cardsDrawn}.`
  return `${memberName(action.memberId)}'s disconnected turn was resolved.`
})

function memberName(memberId?: string): string {
  return props.match.members.find(member => member.id === memberId)?.displayName ?? 'Player'
}

function send(command: UnoUiCommand) {
  emit('command', command)
}

function selectCard(card: UnoCard) {
  if (!playable.value.has(card.id)) return
  if (card.kind === 'wild' || card.kind === 'wild-draw-four') {
    pendingWildCard.value = card
    return
  }
  playCard(card)
}

function playCard(card: UnoCard, declaredColor?: UnoColor) {
  send({ type: 'uno.card.play', cardId: card.id, declaredColor, calledUno: unoArmed.value })
  pendingWildCard.value = null
  unoArmed.value = false
}

function chooseColor(color: UnoColor) {
  if (pendingWildCard.value) playCard(pendingWildCard.value, color)
  else send({ type: 'uno.color.choose', color })
}

watch(() => view.value.hand.length, (count) => {
  if (count !== 2) unoArmed.value = false
})

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now() + props.serverOffset
  }, 250)
})

onScopeDispose(() => {
  if (clock) clearInterval(clock)
})
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
    <section class="uno-table-shell">
      <div class="uno-table__header">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :color="connected ? 'success' : 'warning'"
            variant="soft"
          >
            {{ connected ? 'Table connected' : 'Reconnecting' }}
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
          >
            Round {{ view.roundNumber }}
          </UBadge>
          <span
            class="uno-color-chip"
            :class="`uno-color-chip--${view.activeColor ?? 'wild'}`"
          >{{ activeColorLabel }}</span>
          <span class="font-mono text-xs font-bold text-white/55">{{ view.direction === 1 ? '↻ clockwise' : '↺ counterclockwise' }}</span>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-book-open"
          class="text-white"
          @click="rulesOpen = true"
        >
          Rules
        </UButton>
      </div>

      <div
        class="uno-opponents"
        aria-label="Opponents"
      >
        <article
          v-for="opponent in opponents"
          :key="opponent.member?.id"
          class="uno-seat"
          :class="{ 'uno-seat--active': opponent.member?.id === view.activeMemberId }"
        >
          <span
            class="uno-seat__dot"
            :class="opponent.member?.connected ? 'bg-emerald-400' : 'bg-amber-400'"
          />
          <div class="min-w-0">
            <p class="truncate font-bold">
              {{ opponent.member?.displayName }}
            </p><p class="font-mono text-[0.68rem] text-white/50">
              {{ opponent.cardCount }} cards
            </p>
          </div>
          <span
            v-if="opponent.cardCount === 1"
            class="uno-seat__uno"
          >UNO</span>
        </article>
      </div>

      <div class="uno-stage">
        <UnoTableScene
          :top-card="view.topCard"
          :active-color="view.activeColor"
          :direction="view.direction"
          :draw-pile-count="view.drawPileCount"
          :seat-count="opponents.length"
          :active-seat-index="activeOpponentIndex"
          :action-key="actionKey"
        />

        <div class="uno-stage__public">
          <div
            class="uno-pile"
            aria-label="Draw pile"
          >
            <div class="uno-card-back">
              <span>MB</span>
            </div>
            <p>{{ view.drawPileCount }} left</p>
          </div>
          <div
            class="uno-compass"
            :class="`uno-compass--${view.activeColor ?? 'wild'}`"
            aria-hidden="true"
          />
          <div
            class="uno-pile"
            aria-label="Discard pile"
          >
            <UnoCard
              v-if="view.topCard"
              :card="view.topCard"
              display-only
            />
            <p>Discard</p>
          </div>
        </div>

        <div class="uno-stage__status">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            {{ dealer?.displayName }} deals
          </p>
          <h1 class="mt-1 font-display text-2xl font-black text-white sm:text-3xl">
            {{ view.activeMemberId === match.viewerMemberId ? 'The table is yours.' : `${activeMember?.displayName ?? 'Player'} is choosing.` }}
          </h1>
        </div>
      </div>

      <div class="relative z-20 space-y-3 px-3 pb-4 sm:px-5">
        <UnoColorPicker
          v-if="pendingWildCard"
          cancelable
          @choose="chooseColor"
          @cancel="pendingWildCard = null"
        />
        <UnoColorPicker
          v-else-if="view.canChooseStartingColor"
          title="Choose the opening color"
          @choose="chooseColor"
        />
        <UnoActionPanel
          v-else
          :view="view"
          :members="match.members"
          :viewer-member-id="match.viewerMemberId"
          :uno-armed="unoArmed"
          :now="now"
          @draw="send({ type: 'uno.card.draw' })"
          @pass="send({ type: 'uno.turn.pass' })"
          @call="send({ type: 'uno.call' })"
          @catch="send({ type: 'uno.catch' })"
          @respond="send({ type: 'uno.wild-draw-four.respond', response: $event })"
          @toggle-uno="unoArmed = !unoArmed"
          @resolve-disconnect="send({ type: 'uno.turn.resolve-disconnect', memberId: $event })"
        />

        <div class="uno-hand-shell">
          <div class="flex items-center justify-between px-3 pt-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                Your hand
              </p><p class="font-mono text-sm font-bold text-white">
                {{ viewer?.displayName }} · {{ view.hand.length }} cards
              </p>
            </div>
            <span
              v-if="view.drawnCardId"
              class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70"
            >Drawn card highlighted</span>
          </div>
          <UnoHand
            :cards="view.hand"
            :playable-card-ids="view.playableCardIds"
            :drawn-card-id="view.drawnCardId"
            @play="selectCard"
          />
        </div>
      </div>

      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ announcement }}
      </p>
    </section>

    <aside class="space-y-5">
      <MatchScoreboard
        :members="match.members"
        title="Score race"
      />
      <div class="rounded-xl bg-[#11151D] p-5 text-white">
        <div class="flex items-center justify-between">
          <p class="font-display text-lg font-black">
            Finish line
          </p><span class="font-mono text-xl font-black text-[#FFC928]">{{ match.game.settings.targetScore.toLocaleString() }}</span>
        </div>
        <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-[#FFC928]"
            :style="{ width: `${Math.min(100, Math.max(...Object.values(view.scores), 0) / match.game.settings.targetScore * 100)}%` }"
          />
        </div>
        <p class="mt-3 text-xs leading-relaxed text-white/55">
          Numbers score face value. Skip, Reverse, and Draw Two score 20. Wild cards score 50.
        </p>
      </div>
    </aside>

    <UnoRulesModal
      v-model:open="rulesOpen"
      :target-score="match.game.settings.targetScore"
    />
  </div>
</template>

<style scoped>
.uno-table-shell { position: relative; overflow: hidden; border: 1px solid rgb(255 255 255 / 8%); border-radius: 1.25rem; background: #0b0e14; box-shadow: 0 1.5rem 4rem rgb(5 8 14 / 22%); }
.uno-table__header { position: relative; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.15rem 0; }
.uno-color-chip { border: 1px solid rgb(255 255 255 / 20%); border-radius: 999px; padding: .3rem .65rem; color: white; font-size: .72rem; font-weight: 800; }
.uno-color-chip--red { background: #e53935; }
.uno-color-chip--yellow { background: #ffc928; color: #11151d; }
.uno-color-chip--green { background: #18a957; }
.uno-color-chip--blue { background: #1677e8; }
.uno-color-chip--wild { background: conic-gradient(#e53935, #ffc928, #18a957, #1677e8, #e53935); }
.uno-opponents { position: relative; z-index: 20; display: flex; gap: .55rem; overflow-x: auto; padding: 1rem 1.15rem .2rem; }
.uno-seat { display: grid; min-width: 8.5rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .5rem; border: 1px solid rgb(255 255 255 / 9%); border-radius: .8rem; background: rgb(255 255 255 / 5%); padding: .55rem .65rem; color: white; transition: border-color 160ms ease, background 160ms ease; }
.uno-seat--active { border-color: rgb(255 201 40 / 70%); background: rgb(255 201 40 / 11%); }
.uno-seat__dot { width: .42rem; height: .42rem; border-radius: 999px; }
.uno-seat__uno { border-radius: .35rem; background: #e53935; padding: .18rem .32rem; font-family: 'IBM Plex Mono', monospace; font-size: .58rem; font-weight: 800; }
.uno-stage { position: relative; min-height: 25rem; }
.uno-stage::after { position: absolute; inset: 12% 8% 0; border-radius: 50%; background: radial-gradient(circle at 50% 45%, rgb(255 255 255 / 5%), transparent 62%); content: ''; pointer-events: none; }
.uno-stage__public { position: absolute; z-index: 10; left: 50%; top: 47%; display: flex; align-items: center; gap: 1.4rem; transform: translate(-50%, -50%); }
.uno-pile { display: grid; justify-items: center; gap: .5rem; color: rgb(255 255 255 / 48%); font-family: 'IBM Plex Mono', monospace; font-size: .68rem; font-weight: 700; }
.uno-card-back { display: grid; width: clamp(4.3rem, 8vw, 6.2rem); aspect-ratio: .68; place-items: center; border: .24rem solid #fff7e6; border-radius: .78rem; background: repeating-linear-gradient(135deg, #8b181b 0 10px, #b92125 10px 20px); color: #fff7e6; box-shadow: 0 .55rem 1.1rem rgb(4 9 18 / 35%); transform: rotate(-5deg); }
.uno-card-back span { display: grid; width: 62%; aspect-ratio: 1; place-items: center; border-radius: 50%; background: #11151d; font-family: 'Funnel Sans', sans-serif; font-weight: 900; transform: rotate(-12deg); }
.uno-compass { width: 1rem; height: 1rem; border-radius: 50%; box-shadow: 0 0 1.4rem .45rem currentColor; color: #fff7e6; }
.uno-compass--red { color: #e53935; }.uno-compass--yellow { color: #ffc928; }.uno-compass--green { color: #18a957; }.uno-compass--blue { color: #1677e8; }.uno-compass--wild { background: conic-gradient(#e53935, #ffc928, #18a957, #1677e8); }
.uno-stage__status { position: absolute; z-index: 15; bottom: 1.2rem; left: 50%; width: min(92%, 36rem); transform: translateX(-50%); text-align: center; text-shadow: 0 2px 18px #000; }
.uno-hand-shell { overflow: hidden; border: 1px solid rgb(255 255 255 / 9%); border-radius: 1rem; background: linear-gradient(180deg, rgb(255 255 255 / 6%), rgb(255 255 255 / 2%)); }
@media (max-width: 640px) { .uno-stage { min-height: 21rem; } .uno-stage__public { gap: .75rem; } .uno-stage__status { bottom: .5rem; } }
@media (prefers-reduced-motion: reduce) { .uno-seat { transition: none; } }
</style>
