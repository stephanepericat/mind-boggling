<script setup lang="ts">
import { cardLabel } from '#shared/games/uno'
import type { UnoCard, UnoColor, UnoCommand, UnoLastAction } from '#shared/games/uno'
import type { UnoMatchView } from '../../../shared/types/api'

type WithoutIdempotency<T> = T extends { idempotencyKey: string } ? Omit<T, 'idempotencyKey'> : never
type UnoUiCommand = WithoutIdempotency<UnoCommand>

const props = defineProps<{ match: UnoMatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{ command: [command: UnoUiCommand] }>()
const toast = useToast()

const rulesOpen = shallowRef(false)
const unoArmed = shallowRef(false)
const pendingWildCard = shallowRef<UnoCard | null>(null)
const unoCelebration = shallowRef<{ name: string, caught: boolean } | null>(null)
const now = shallowRef(Date.now() + props.serverOffset)
let clock: ReturnType<typeof setInterval> | null = null
let celebrationTimer: ReturnType<typeof setTimeout> | null = null

const view = computed(() => props.match.game.view)
const viewer = computed(() => props.match.members.find(member => member.id === props.match.viewerMemberId))
const activeMember = computed(() => props.match.members.find(member => member.id === view.value.activeMemberId))
const dealer = computed(() => props.match.members.find(member => member.id === view.value.dealerMemberId))
const isViewerTurn = computed(() => view.value.activeMemberId === props.match.viewerMemberId)
const opponents = computed(() => view.value.turnOrder
  .filter(memberId => memberId !== props.match.viewerMemberId)
  .map(memberId => ({
    member: props.match.members.find(member => member.id === memberId),
    cardCount: view.value.opponents.find(opponent => opponent.memberId === memberId)?.cardCount ?? 0,
    vulnerable: view.value.vulnerableMemberId === memberId
  })))
const activeOpponentIndex = computed(() => opponents.value.findIndex(opponent => opponent.member?.id === view.value.activeMemberId))
const playable = computed(() => new Set(view.value.playableCardIds))
const actionKey = computed(() => `${props.match.sequence}:${view.value.lastAction?.type ?? 'deal'}:${view.value.topCard?.id ?? 'none'}`)
const activeColorLabel = computed(() => view.value.activeColor ? `${view.value.activeColor[0]!.toUpperCase()}${view.value.activeColor.slice(1)}` : 'Wild')
const tableStyle = computed(() => ({ '--uno-active': colorHex(view.value.activeColor) }))
const turnHeadline = computed(() => {
  if (view.value.pendingWildDrawFour?.canRespond) return 'Choose: accept four or challenge.'
  if (isViewerTurn.value) return 'Your turn. The raised cards are ready.'
  return `${activeMember.value?.displayName ?? 'Player'} is choosing.`
})
const { soundEnabled, toggleSound } = useUnoTurnCue(isViewerTurn)

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

function colorHex(color?: UnoColor): string {
  if (color === 'red') return '#ef4b46'
  if (color === 'yellow') return '#ffc928'
  if (color === 'green') return '#29c469'
  if (color === 'blue') return '#378fea'
  return '#fff7e6'
}

function memberName(memberId?: string): string {
  return props.match.members.find(member => member.id === memberId)?.displayName ?? 'Player'
}

function send(command: UnoUiCommand) {
  emit('command', command)
}

function catchUno() {
  send({ type: 'uno.catch' })
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

function showUnoNotification(action: UnoLastAction) {
  if (action.type === 'uno-called' || (action.type === 'played' && action.calledUno)) {
    const name = memberName(action.memberId)
    unoCelebration.value = { name, caught: false }
    toast.add({
      title: 'UNO!',
      description: `${name} is down to one card.`,
      color: 'warning',
      icon: 'i-lucide-megaphone'
    })
  } else if (action.type === 'uno-caught') {
    const caughtName = memberName(action.memberId)
    unoCelebration.value = { name: caughtName, caught: true }
    toast.add({
      title: 'Caught without UNO',
      description: `${memberName(action.caughtByMemberId)} caught ${caughtName}. Two cards added.`,
      color: 'error',
      icon: 'i-lucide-zap'
    })
  } else {
    return
  }

  if (celebrationTimer) clearTimeout(celebrationTimer)
  celebrationTimer = setTimeout(() => {
    unoCelebration.value = null
  }, 2400)
}

watch(() => view.value.hand.length, (count) => {
  if (count !== 2) unoArmed.value = false
})

watch(() => view.value.lastAction?.at, (at, previousAt) => {
  const action = view.value.lastAction
  if (!action || !at || at === previousAt) return
  showUnoNotification(action)
})

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now() + props.serverOffset
  }, 250)
})

onScopeDispose(() => {
  if (clock) clearInterval(clock)
  if (celebrationTimer) clearTimeout(celebrationTimer)
})
</script>

<template>
  <div class="uno-game-layout">
    <section
      class="uno-table-shell"
      :class="{
        'uno-table-shell--your-turn': isViewerTurn,
        'uno-table-shell--catch': view.canCatchUno
      }"
      :style="tableStyle"
    >
      <header class="uno-table__header">
        <div class="uno-table__meta">
          <span
            class="uno-connection"
            :class="connected ? 'uno-connection--live' : 'uno-connection--waiting'"
          >
            <span />{{ connected ? 'Live' : 'Reconnecting' }}
          </span>
          <strong>Round {{ view.roundNumber }}</strong>
          <span
            class="uno-color-chip"
            :class="`uno-color-chip--${view.activeColor ?? 'wild'}`"
          >{{ activeColorLabel }}</span>
          <span class="uno-direction">
            <UIcon
              :name="view.direction === 1 ? 'i-lucide-rotate-cw' : 'i-lucide-rotate-ccw'"
              class="size-3.5"
              aria-hidden="true"
            />
            {{ view.direction === 1 ? 'Clockwise' : 'Counterclockwise' }}
          </span>
        </div>

        <div class="uno-table__tools">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="soundEnabled ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
            :aria-label="soundEnabled ? 'Turn sound on. Click to mute.' : 'Turn sound muted. Click to enable.'"
            :title="soundEnabled ? 'Mute turn sound' : 'Enable turn sound'"
            class="text-white"
            @click="toggleSound"
          />
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
      </header>

      <div
        class="uno-opponents"
        aria-label="Opponents"
      >
        <article
          v-for="opponent in opponents"
          :key="opponent.member?.id"
          class="uno-seat"
          :class="{
            'uno-seat--active': opponent.member?.id === view.activeMemberId,
            'uno-seat--vulnerable': opponent.vulnerable
          }"
        >
          <span
            class="uno-seat__dot"
            :class="opponent.member?.connected ? 'bg-emerald-400' : 'bg-amber-400'"
          />
          <div class="min-w-0">
            <p class="uno-seat__name">
              {{ opponent.member?.displayName }}
            </p>
            <p class="uno-seat__count">
              {{ opponent.cardCount }} {{ opponent.cardCount === 1 ? 'card' : 'cards' }}
            </p>
          </div>
          <button
            v-if="opponent.vulnerable && view.canCatchUno"
            type="button"
            class="uno-seat__catch"
            :aria-label="`Catch ${opponent.member?.displayName} for not calling UNO`"
            @click="catchUno"
          >
            <UIcon
              name="i-lucide-zap"
              class="size-3"
              aria-hidden="true"
            />
            Catch
          </button>
          <span
            v-else-if="opponent.cardCount === 1"
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

        <div
          v-if="isViewerTurn"
          class="uno-turn-beacon"
          role="status"
        >
          <span
            class="uno-turn-beacon__pulse"
            aria-hidden="true"
          />
          <span>Your turn</span>
          <small>Raised cards can be played</small>
        </div>

        <div class="uno-stage__public">
          <div
            class="uno-pile uno-pile--draw"
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
          >
            <span class="uno-compass__core">
              <UIcon
                :name="view.direction === 1 ? 'i-lucide-rotate-cw' : 'i-lucide-rotate-ccw'"
                class="size-5"
              />
            </span>
          </div>

          <div
            class="uno-pile uno-pile--discard"
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
          <h1>{{ turnHeadline }}</h1>
          <p>{{ dealer?.displayName }} deals · {{ activeColorLabel }} is active</p>
        </div>

        <Transition name="uno-callout">
          <div
            v-if="unoCelebration"
            class="uno-callout"
            :class="{ 'uno-callout--caught': unoCelebration.caught }"
            role="status"
          >
            <strong>{{ unoCelebration.caught ? 'Caught!' : 'UNO!' }}</strong>
            <span>{{ unoCelebration.name }}</span>
          </div>
        </Transition>
      </div>

      <div class="uno-table__controls">
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
          @catch="catchUno"
          @respond="send({ type: 'uno.wild-draw-four.respond', response: $event })"
          @toggle-uno="unoArmed = !unoArmed"
          @resolve-disconnect="send({ type: 'uno.turn.resolve-disconnect', memberId: $event })"
        />
      </div>

      <div class="uno-hand-shell">
        <div class="uno-hand-shell__header">
          <p>
            <strong>{{ viewer?.displayName }}</strong>
            <span>{{ view.hand.length }} cards · sorted by color and value</span>
          </p>
          <span
            v-if="view.drawnCardId"
            class="uno-drawn-label"
          >Drawn card</span>
        </div>
        <UnoHand
          :cards="view.hand"
          :playable-card-ids="view.playableCardIds"
          :drawn-card-id="view.drawnCardId"
          @play="selectCard"
        />
      </div>

      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ announcement }}
      </p>
    </section>

    <UnoScoreRail
      :members="match.members"
      :scores="view.scores"
      :target-score="match.game.settings.targetScore"
      :active-member-id="view.activeMemberId"
      :viewer-member-id="match.viewerMemberId"
      :active-color="view.activeColor"
    />

    <UnoRulesModal
      v-model:open="rulesOpen"
      :target-score="match.game.settings.targetScore"
    />
  </div>
</template>

<style scoped>
.uno-game-layout {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 15.5rem;
  gap: 0.75rem;
}

.uno-table-shell {
  --uno-active: #fff7e6;
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.9rem;
  background: #090d13;
  color: #fff7e6;
  box-shadow: 0 1.4rem 3.4rem rgb(4 8 16 / 26%);
  isolation: isolate;
}

.uno-table-shell::before {
  position: absolute;
  z-index: 1;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--uno-active) 26%, transparent);
  border-radius: inherit;
  content: '';
  pointer-events: none;
  transition: border-color 220ms ease, box-shadow 220ms ease;
}

.uno-table-shell--your-turn::before {
  border-color: color-mix(in srgb, var(--uno-active) 72%, white 12%);
  box-shadow: inset 0 0 2.2rem color-mix(in srgb, var(--uno-active) 14%, transparent);
}

.uno-table-shell--catch::before { border-color: #ff655f; }

.uno-table__header {
  position: relative;
  z-index: 30;
  display: flex;
  min-height: 3.45rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.8rem;
  background: rgb(7 10 15 / 92%);
}

.uno-table__meta,
.uno-table__tools,
.uno-direction,
.uno-connection {
  display: flex;
  align-items: center;
}

.uno-table__meta { min-width: 0; gap: 0.55rem; font-size: 0.72rem; }
.uno-table__meta > strong { white-space: nowrap; }
.uno-table__tools { gap: 0.1rem; }
.uno-connection { gap: 0.32rem; color: rgb(255 247 230 / 66%); font-weight: 750; }
.uno-connection > span { width: 0.42rem; height: 0.42rem; border-radius: 50%; }
.uno-connection--live > span { background: #45d483; box-shadow: 0 0 0 0.2rem rgb(69 212 131 / 12%); }
.uno-connection--waiting > span { background: #ffc928; }
.uno-direction { gap: 0.3rem; color: rgb(255 247 230 / 62%); font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; font-weight: 700; white-space: nowrap; }

.uno-color-chip {
  border-radius: 999px;
  padding: 0.24rem 0.55rem;
  color: white;
  font-size: 0.68rem;
  font-weight: 850;
  box-shadow: inset 0 -0.18rem 0 rgb(0 0 0 / 12%);
}

.uno-color-chip--red { background: #e53935; }
.uno-color-chip--yellow { background: #ffc928; color: #11151d; }
.uno-color-chip--green { background: #18a957; }
.uno-color-chip--blue { background: #1677e8; }
.uno-color-chip--wild { background: conic-gradient(#e53935, #ffc928, #18a957, #1677e8, #e53935); }

.uno-opponents {
  position: relative;
  z-index: 20;
  display: flex;
  min-height: 3.3rem;
  flex: 0 0 auto;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.4rem 0.65rem 0.25rem;
  scrollbar-color: rgb(255 247 230 / 22%) transparent;
  scrollbar-width: thin;
}

.uno-seat {
  display: grid;
  min-width: 7.65rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  border-radius: 0.62rem;
  background: rgb(255 247 230 / 6%);
  padding: 0.42rem 0.52rem;
  color: #fff7e6;
  transition: background 180ms ease, transform 180ms cubic-bezier(.16, 1, .3, 1);
}

.uno-seat--active { background: color-mix(in srgb, var(--uno-active) 15%, transparent); transform: translateY(-0.1rem); }
.uno-seat--vulnerable { background: rgb(229 57 53 / 16%); }
.uno-seat__dot { width: 0.38rem; height: 0.38rem; border-radius: 50%; }
.uno-seat__name { overflow: hidden; font-size: 0.72rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.uno-seat__count { color: rgb(255 247 230 / 58%); font-family: 'IBM Plex Mono', monospace; font-size: 0.59rem; font-weight: 700; }
.uno-seat__uno { border-radius: 0.3rem; background: #e53935; padding: 0.14rem 0.26rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.53rem; font-weight: 900; }
.uno-seat__catch { display: flex; min-height: 1.65rem; align-items: center; gap: 0.2rem; border-radius: 0.35rem; background: #e53935; padding: 0.2rem 0.35rem; color: white; font-size: 0.58rem; font-weight: 900; }
.uno-seat__catch:hover { background: #ff514c; }
.uno-seat__catch:focus-visible { outline: 3px solid #fff7e6; outline-offset: 2px; }

.uno-stage {
  position: relative;
  min-height: 8.5rem;
  flex: 1 1 auto;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 54%, color-mix(in srgb, var(--uno-active) 9%, transparent), transparent 45%),
    linear-gradient(116deg, rgb(255 255 255 / 2%), transparent 35%);
}

.uno-stage::before {
  position: absolute;
  z-index: 2;
  inset: 4% 4% 1%;
  border: 1px solid rgb(255 247 230 / 8%);
  border-radius: 50%;
  box-shadow: inset 0 1rem 2.5rem rgb(255 255 255 / 2%), 0 0.8rem 2rem rgb(0 0 0 / 22%);
  content: '';
  pointer-events: none;
}

.uno-stage::after {
  position: absolute;
  z-index: 3;
  inset: 10% 11% 5%;
  border-radius: 50%;
  background: conic-gradient(from 35deg, rgb(229 57 53 / 9%), rgb(255 201 40 / 7%), rgb(24 169 87 / 8%), rgb(22 119 232 / 8%), rgb(229 57 53 / 9%));
  mask: radial-gradient(transparent 0 68%, #000 69% 74%, transparent 75%);
  content: '';
  pointer-events: none;
}

.uno-turn-beacon {
  position: absolute;
  z-index: 18;
  top: 0.45rem;
  left: 50%;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0 0.48rem;
  border-radius: 999px;
  background: var(--uno-active);
  padding: 0.35rem 0.75rem 0.35rem 0.42rem;
  color: #11151d;
  box-shadow: 0 0.55rem 1.4rem rgb(0 0 0 / 30%);
  transform: translateX(-50%);
}

.uno-turn-beacon > span:not(.uno-turn-beacon__pulse) { font-size: 0.75rem; font-weight: 900; }
.uno-turn-beacon small { grid-column: 2; font-size: 0.57rem; font-weight: 700; opacity: 0.72; }
.uno-turn-beacon__pulse { grid-row: 1 / 3; width: 0.62rem; aspect-ratio: 1; border-radius: 50%; background: #11151d; box-shadow: 0 0 0 0 rgb(17 21 29 / 35%); animation: turn-pulse 1.8s ease-out infinite; }

.uno-stage__public {
  position: absolute;
  z-index: 10;
  left: 50%;
  top: 47%;
  display: grid;
  grid-template-columns: auto clamp(3.5rem, 7vw, 5.1rem) auto;
  align-items: center;
  gap: clamp(0.7rem, 2vw, 1.45rem);
  transform: translate(-50%, -50%);
}

.uno-pile { display: grid; justify-items: center; gap: 0.32rem; color: rgb(255 247 230 / 58%); font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; font-weight: 750; }
.uno-pile--draw { position: relative; }
.uno-pile--draw::before,
.uno-pile--draw::after { position: absolute; z-index: -1; top: -0.16rem; width: clamp(4rem, 7vw, 5.5rem); aspect-ratio: 0.68; border: 0.18rem solid #fff7e6; border-radius: 0.65rem; background: #76161a; content: ''; }
.uno-pile--draw::before { left: 0.2rem; transform: rotate(4deg); }
.uno-pile--draw::after { right: 0.14rem; transform: rotate(-3deg); }

.uno-card-back {
  display: grid;
  width: clamp(4rem, 7vw, 5.5rem);
  aspect-ratio: 0.68;
  place-items: center;
  border: 0.22rem solid #fff7e6;
  border-radius: 0.68rem;
  background: radial-gradient(ellipse at center, #bd282c 0 38%, #8b181b 39% 100%);
  color: #fff7e6;
  box-shadow: 0 0.55rem 1.1rem rgb(4 9 18 / 35%);
  transform: rotate(-5deg);
}

.uno-card-back span { display: grid; width: 62%; aspect-ratio: 1; place-items: center; border: 2px solid rgb(255 247 230 / 70%); border-radius: 50%; background: #11151d; font-family: 'Funnel Sans', sans-serif; font-size: 0.82rem; font-weight: 900; transform: rotate(-12deg); }

.uno-compass {
  position: relative;
  display: grid;
  width: clamp(3.5rem, 7vw, 5.1rem);
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#e53935 0 25%, #ffc928 0 50%, #18a957 0 75%, #1677e8 0);
  box-shadow: 0 0 1.8rem color-mix(in srgb, var(--uno-active) 34%, transparent);
  transform: rotate(-12deg);
}

.uno-compass::before { position: absolute; inset: 0.28rem; border: 0.2rem solid var(--uno-active); border-radius: 50%; background: #11151d; content: ''; }
.uno-compass__core { position: relative; z-index: 1; display: grid; width: 68%; aspect-ratio: 1; place-items: center; border-radius: 50%; color: var(--uno-active); transform: rotate(12deg); }

.uno-stage__status {
  position: absolute;
  z-index: 16;
  bottom: 0.45rem;
  left: 50%;
  width: min(92%, 40rem);
  transform: translateX(-50%);
  text-align: center;
  text-shadow: 0 2px 14px #000;
}

.uno-stage__status h1 { color: #fff7e6; font-family: 'Funnel Sans', sans-serif; font-size: clamp(1rem, 2.2vw, 1.55rem); font-weight: 900; letter-spacing: -0.025em; line-height: 1.05; }
.uno-stage__status p { margin-top: 0.18rem; color: rgb(255 247 230 / 58%); font-size: 0.62rem; font-weight: 700; }

.uno-callout {
  position: absolute;
  z-index: 40;
  top: 46%;
  left: 50%;
  display: grid;
  min-width: 8rem;
  justify-items: center;
  color: #ffc928;
  filter: drop-shadow(0 0.8rem 1.2rem rgb(0 0 0 / 46%));
  transform: translate(-50%, -50%) rotate(-6deg);
}

.uno-callout strong { font-family: 'Funnel Sans', sans-serif; font-size: clamp(3rem, 8vw, 5.5rem); font-style: italic; font-weight: 950; letter-spacing: -0.04em; line-height: 0.84; }
.uno-callout span { margin-top: 0.45rem; border-radius: 999px; background: #11151d; padding: 0.28rem 0.75rem; color: #fff7e6; font-size: 0.7rem; font-weight: 800; }
.uno-callout--caught { color: #ff5c56; }
.uno-callout-enter-active { transition: clip-path 360ms cubic-bezier(.16, 1, .3, 1), filter 360ms cubic-bezier(.16, 1, .3, 1), transform 360ms cubic-bezier(.16, 1, .3, 1); }
.uno-callout-leave-active { transition: opacity 140ms ease; }
.uno-callout-enter-from { clip-path: inset(45% 0 45%); filter: blur(10px); transform: translate(-50%, -50%) rotate(-6deg) scale(0.82); }
.uno-callout-leave-to { opacity: 0; }

.uno-table__controls { position: relative; z-index: 25; flex: 0 0 auto; padding: 0.25rem 0.55rem; }
.uno-hand-shell { position: relative; z-index: 22; flex: 0 0 auto; overflow: hidden; background: linear-gradient(180deg, rgb(255 247 230 / 8%), rgb(255 247 230 / 3%)); }
.uno-hand-shell__header { display: flex; min-height: 2.2rem; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 0.35rem 0.8rem 0; }
.uno-hand-shell__header p { min-width: 0; }
.uno-hand-shell__header strong { display: block; overflow: hidden; color: #fff7e6; font-size: 0.74rem; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.uno-hand-shell__header span { display: block; color: rgb(255 247 230 / 58%); font-size: 0.59rem; font-weight: 700; }
.uno-drawn-label { flex: 0 0 auto; border-radius: 999px; background: rgb(255 201 40 / 14%); padding: 0.22rem 0.48rem; color: #ffe17b !important; font-size: 0.58rem !important; }

@keyframes turn-pulse {
  70%, 100% { box-shadow: 0 0 0 0.45rem rgb(17 21 29 / 0%); }
}

@media (max-width: 1099px) {
  .uno-game-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 0.45rem; }
}

@media (max-width: 640px) {
  .uno-table-shell { border-radius: 0.65rem; }
  .uno-table__header { min-height: 3rem; padding: 0.35rem 0.5rem; }
  .uno-table__meta { gap: 0.38rem; }
  .uno-direction { font-size: 0; }
  .uno-direction :deep(svg) { width: 0.9rem; height: 0.9rem; }
  .uno-connection { font-size: 0; }
  .uno-connection > span { width: 0.48rem; height: 0.48rem; }
  .uno-table__tools :deep(span) { display: none; }
  .uno-opponents { min-height: 2.85rem; padding: 0.25rem 0.45rem 0.15rem; }
  .uno-seat { min-width: 6.6rem; padding: 0.3rem 0.42rem; }
  .uno-seat__catch { font-size: 0; }
  .uno-seat__catch :deep(svg) { width: 0.85rem; height: 0.85rem; }
  .uno-turn-beacon { top: 0.25rem; }
  .uno-turn-beacon small { display: none; }
  .uno-turn-beacon__pulse { grid-row: auto; }
  .uno-stage__public { top: 47%; gap: 0.55rem; }
  .uno-stage__status p { display: none; }
  .uno-table__controls { padding: 0.18rem 0.35rem; }
  .uno-hand-shell__header { min-height: 1.75rem; padding-top: 0.2rem; }
}

@media (max-height: 680px) {
  .uno-table__header { min-height: 2.8rem; }
  .uno-opponents { min-height: 2.6rem; }
  .uno-stage__status p { display: none; }
  .uno-hand-shell__header { min-height: 1.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .uno-table-shell::before,
  .uno-seat,
  .uno-callout-enter-active,
  .uno-callout-leave-active { transition: none; }
  .uno-turn-beacon__pulse { animation: none; }
}
</style>
