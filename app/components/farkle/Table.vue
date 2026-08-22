<script setup lang="ts">
import { scoreSelection } from '#shared/games/farkle/scoring'
import type { FarkleMatchView } from '../../../shared/types/api'

const props = defineProps<{ match: FarkleMatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{
  roll: []
  continue: [rollId: string, selectedDieIds: string[]]
  bank: [rollId: string, selectedDieIds: string[]]
  skip: [memberId: string]
}>()

const selectedDieIds = ref<string[]>([])
const now = shallowRef(Date.now())
const openingRoundIndex = shallowRef(0)
const showOpening = shallowRef(true)
let clock: ReturnType<typeof setInterval> | null = null
let openingTimer: ReturnType<typeof setTimeout> | null = null

const game = computed(() => props.match.game.view)
const turn = computed(() => game.value.turn)
const currentRoll = computed(() => turn.value?.currentRoll)
const isActivePlayer = computed(() => turn.value?.memberId === props.match.viewerMemberId)
const activeMember = computed(() => props.match.members.find(member => member.id === game.value.activeMemberId))
const selectedDice = computed(() => currentRoll.value?.dice.filter(die => selectedDieIds.value.includes(die.id)) ?? [])
const selectionScore = computed(() => scoreSelection(selectedDice.value))
const projectedBank = computed(() => (turn.value?.unbankedScore ?? 0) + (selectionScore.value?.score ?? 0))
const needsOpeningScore = computed(() => !game.value.hasEnteredScoreboard[props.match.viewerMemberId])
const canBank = computed(() => Boolean(selectionScore.value && (!needsOpeningScore.value || projectedBank.value >= 500)))
const skipSeconds = computed(() => game.value.skipEligibleAt
  ? Math.max(0, Math.ceil((game.value.skipEligibleAt - (now.value + props.serverOffset)) / 1000))
  : 0)
const canSkipNow = computed(() => game.value.canSkipActivePlayer && skipSeconds.value === 0)
const openingRound = computed(() => game.value.openingRollRounds[openingRoundIndex.value])
const openingDice = computed(() => Object.entries(openingRound.value?.valuesByMemberId ?? {}).map(([id, face]) => ({ id, face, faceIndex: face - 1 })))
const openingWinner = computed(() => props.match.members.find(member => member.id === game.value.turnOrder[0]))

watch(() => currentRoll.value?.id, () => {
  selectedDieIds.value = []
})

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 250)
  const showNext = () => {
    if (openingRoundIndex.value < game.value.openingRollRounds.length - 1) {
      openingRoundIndex.value += 1
      openingTimer = setTimeout(showNext, 1000)
    } else {
      openingTimer = setTimeout(() => {
        showOpening.value = false
      }, 1100)
    }
  }
  openingTimer = setTimeout(showNext, 1000)
})

onScopeDispose(() => {
  if (clock) clearInterval(clock)
  if (openingTimer) clearTimeout(openingTimer)
})

function toggleDie(dieId: string) {
  selectedDieIds.value = selectedDieIds.value.includes(dieId)
    ? selectedDieIds.value.filter(id => id !== dieId)
    : [...selectedDieIds.value, dieId]
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section class="game-panel relative overflow-hidden rounded-xl p-5 sm:p-8">
      <div
        v-if="showOpening && openingRound"
        class="absolute inset-0 z-20 grid place-items-center bg-slate-950/95 p-6 text-white backdrop-blur-sm"
      >
        <div class="w-full max-w-2xl text-center">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary-300">
            Opening high roll · round {{ openingRoundIndex + 1 }}
          </p>
          <h1 class="mt-2 font-display text-3xl font-extrabold">
            {{ openingRound.tiedLeaderMemberIds.length === 1 ? `${openingWinner?.displayName} starts` : 'Top roll ties — roll again' }}
          </h1>
          <DiceScene
            :dice="openingDice"
            :roll-id="openingRound.rollId"
            class="mt-5"
          />
          <ul
            class="mt-3 flex flex-wrap justify-center gap-3"
            aria-live="polite"
          >
            <li
              v-for="die in openingDice"
              :key="die.id"
              class="rounded-lg bg-white/10 px-3 py-2 font-mono font-bold"
            >
              {{ match.members.find(member => member.id === die.id)?.displayName }} · {{ die.face }}
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              :color="connected ? 'success' : 'warning'"
              variant="soft"
            >
              {{ connected ? 'Room connected' : 'Reconnecting' }}
            </UBadge>
            <UBadge
              v-if="game.phase === 'final-turns'"
              color="warning"
              variant="soft"
            >
              Final turns
            </UBadge>
            <UBadge
              v-if="game.phase === 'sudden-death'"
              color="error"
              variant="soft"
            >
              Sudden death · cycle {{ game.suddenDeath?.cycle }}
            </UBadge>
          </div>
          <h1 class="mt-3 font-display text-4xl font-extrabold">
            {{ isActivePlayer ? 'Your roll.' : `${activeMember?.displayName ?? 'Player'} is rolling.` }}
          </h1>
          <p class="mt-2 text-slate-600">
            Turn {{ game.turnNumber }} · {{ turn?.availableDieIds.length ?? 6 }} dice available
          </p>
        </div>
        <div class="rounded-xl bg-primary-50 px-5 py-3 text-right">
          <p class="text-xs font-bold uppercase tracking-wide text-primary-700">
            Unbanked
          </p>
          <p class="font-mono text-3xl font-black text-primary-800">
            {{ turn?.unbankedScore ?? 0 }}
          </p>
        </div>
      </div>

      <div class="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
        <DiceTray
          v-if="currentRoll"
          :dice="currentRoll.dice"
          :roll-id="currentRoll.id"
          :selected-die-ids="selectedDieIds"
          :disabled="!isActivePlayer"
          @toggle="toggleDie"
        />
        <div
          v-else
          class="grid min-h-64 place-items-center text-center"
        >
          <div>
            <UIcon
              name="i-lucide-dices"
              class="mx-auto size-14 text-primary-500"
            />
            <p class="mt-3 font-display text-2xl font-bold">
              {{ isActivePlayer ? 'The dice are yours.' : 'Waiting for the roll…' }}
            </p>
            <UButton
              v-if="isActivePlayer"
              size="xl"
              class="mt-5"
              icon="i-lucide-dices"
              @click="emit('roll')"
            >
              Roll {{ turn?.availableDieIds.length ?? 6 }} dice
            </UButton>
          </div>
        </div>
      </div>

      <div
        v-if="currentRoll && isActivePlayer"
        class="mt-5 rounded-xl border border-slate-200 p-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-sm font-semibold">
              Selected score
            </p>
            <p
              class="mt-1 font-mono text-3xl font-black"
              :class="selectionScore ? 'text-primary-700' : 'text-slate-300'"
            >
              {{ selectionScore?.score ?? 0 }} pts
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ selectionScore?.breakdown.map(item => item.label).join(' + ') || 'Select a legal scoring group.' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <UButton
              color="neutral"
              variant="outline"
              size="lg"
              :disabled="!selectionScore"
              @click="emit('continue', currentRoll.id, selectedDieIds)"
            >
              Keep rolling
            </UButton>
            <UButton
              size="lg"
              :disabled="!canBank"
              @click="emit('bank', currentRoll.id, selectedDieIds)"
            >
              Bank {{ projectedBank }}
            </UButton>
          </div>
        </div>
        <p
          v-if="needsOpeningScore && projectedBank < 500"
          class="mt-3 text-sm font-medium text-amber-700"
        >
          You need at least 500 points in this turn to enter the scoreboard.
        </p>
      </div>

      <UAlert
        v-if="game.lastResolution"
        class="mt-5"
        :color="game.lastResolution.type === 'farkled' ? 'error' : game.lastResolution.type === 'skipped' ? 'warning' : 'success'"
        :title="game.lastResolution.type === 'banked' ? `${match.members.find(member => member.id === game.lastResolution?.memberId)?.displayName} banked ${game.lastResolution.points}` : game.lastResolution.type === 'farkled' ? `${match.members.find(member => member.id === game.lastResolution?.memberId)?.displayName} Farkled` : 'Turn skipped'"
      />
    </section>

    <aside class="space-y-5">
      <MatchScoreboard
        :members="match.members"
        title="Scoreboard"
      />
      <div
        v-if="game.canSkipActivePlayer && game.activeMemberId"
        class="rounded-xl border border-amber-200 bg-amber-50 p-5"
      >
        <p class="font-display text-lg font-bold">
          Player disconnected
        </p>
        <p class="mt-1 text-sm text-amber-900">
          {{ skipSeconds > 0 ? `Skip available in ${skipSeconds}s.` : 'Their 60-second grace period has ended.' }}
        </p>
        <UButton
          class="mt-4 w-full"
          color="warning"
          :disabled="!canSkipNow"
          @click="emit('skip', game.activeMemberId)"
        >
          Skip turn
        </UButton>
      </div>
      <div class="rounded-xl bg-slate-950 p-5 text-sm text-white">
        <p class="font-display text-lg font-bold">
          Quick scoring
        </p>
        <dl class="mt-3 space-y-2 text-slate-300">
          <div class="flex justify-between">
            <dt>One 1 / one 5</dt><dd class="font-mono">
              100 / 50
            </dd>
          </div>
          <div class="flex justify-between">
            <dt>Three 1s</dt><dd class="font-mono">
              300
            </dd>
          </div>
          <div class="flex justify-between">
            <dt>Straight / 3 pairs</dt><dd class="font-mono">
              1,500
            </dd>
          </div>
          <div class="flex justify-between">
            <dt>Two triplets</dt><dd class="font-mono">
              2,500
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  </div>
</template>
