<script setup lang="ts">
import type { BoggleMatchView } from '../../../shared/types/api'
import { turnBoggleBoard } from '../../utils/boggleBoardRotation'
import type { BoggleBoardRotation } from '../../utils/boggleBoardRotation'

const props = defineProps<{ match: BoggleMatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{ submit: [word: string, path?: number[]], end: [] }>()

const now = ref(Date.now())
const word = ref('')
const selectedPath = ref<number[]>([])
const boardRotation = shallowRef<BoggleBoardRotation>(0)
let timer: ReturnType<typeof setInterval> | null = null

const gameView = computed(() => props.match.game.view)
const gameSettings = computed(() => props.match.game.settings)
const remainingSeconds = computed(() => Math.max(0, Math.ceil(((gameView.value.roundEndsAt ?? now.value) - (now.value + props.serverOffset)) / 1000)))
const startsInSeconds = computed(() => Math.max(0, Math.ceil(((gameView.value.roundStartedAt ?? now.value) - (now.value + props.serverOffset)) / 1000)))
const hasRoundStarted = computed(() => startsInSeconds.value === 0)
const minutes = computed(() => Math.floor(remainingSeconds.value / 60))
const seconds = computed(() => remainingSeconds.value % 60)
const progress = computed(() => remainingSeconds.value / gameSettings.value.roundSeconds * 100)
const isHost = computed(() => props.match.members.find(member => member.id === props.match.viewerMemberId)?.role === 'host')
const countdownWarningEnabled = computed(() => gameSettings.value.countdownWarning !== false)
const isCountdownActive = computed(() => countdownWarningEnabled.value && remainingSeconds.value >= 1 && remainingSeconds.value <= 10)

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 250)
})
onScopeDispose(() => {
  if (timer) clearInterval(timer)
})

function selectTile(tileId: number) {
  const existingIndex = selectedPath.value.indexOf(tileId)
  if (existingIndex >= 0) {
    selectedPath.value = selectedPath.value.slice(0, existingIndex)
    return
  }
  const tile = gameView.value.board?.tiles[tileId]
  if (!tile) return
  selectedPath.value = [...selectedPath.value, tileId]
  word.value += tile.letters
}

function submit() {
  const value = word.value.trim()
  if (!value) return
  emit('submit', value, selectedPath.value.length ? selectedPath.value : undefined)
  word.value = ''
  selectedPath.value = []
}

function rotateBoard(direction: -1 | 1) {
  boardRotation.value = turnBoggleBoard(boardRotation.value, direction)
}

function endMatch() {
  if (window.confirm('End the match now? The current round will be scored.')) emit('end')
}
</script>

<template>
  <BoggleRoundCountdown
    v-if="gameView.board && !hasRoundStarted"
    :round="gameView.currentRound"
    :rounds="gameSettings.rounds"
    :seconds="startsInSeconds"
  />
  <div
    v-else-if="gameView.board"
    class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]"
  >
    <section class="min-w-0">
      <div
        class="mb-3 flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-white sm:px-5"
        :class="isCountdownActive ? 'bg-red-950' : 'bg-slate-950'"
      >
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary-300">
            Round {{ gameView.currentRound }} of {{ gameSettings.rounds }}
          </p><p class="mt-0.5 hidden text-sm text-slate-300 sm:block">
            Find connected words. Each tile can be used once.
          </p>
        </div>
        <div class="text-right">
          <p
            class="font-mono text-3xl font-black tabular-nums"
            role="timer"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ minutes }}:{{ String(seconds).padStart(2, '0') }}
          </p><p
            class="text-xs"
            :class="connected ? 'text-emerald-300' : 'text-amber-300'"
          >
            {{ connected ? 'Live' : 'Reconnecting' }}
          </p>
        </div>
      </div>
      <BoggleCountdownWarning
        :remaining-seconds="remainingSeconds"
        :enabled="countdownWarningEnabled"
      />
      <UProgress
        :model-value="progress"
        :color="isCountdownActive ? 'error' : 'primary'"
        size="sm"
        class="mb-3"
      />
      <form
        class="mx-auto flex max-w-[38rem] gap-2"
        @submit.prevent="submit"
      >
        <UInput
          v-model="word"
          size="xl"
          autofocus
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="Type a word or tap tiles"
          class="min-w-0 flex-1 font-mono uppercase"
          aria-label="Word to submit"
        />
        <UButton
          type="submit"
          size="xl"
          trailing-icon="i-lucide-send"
        >
          Submit
        </UButton>
      </form>
      <div class="mx-auto mt-1.5 flex max-w-[38rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
        <button
          type="button"
          class="min-h-8 underline underline-offset-2"
          @click="word = ''; selectedPath = []"
        >
          Clear selection
        </button>
        <span>Minimum {{ gameSettings.minWordLength }} letters · Multi-letter tiles count as two</span>
      </div>
      <div class="mx-auto mt-2 flex max-w-[38rem] items-center justify-center gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-rotate-ccw"
          aria-label="Rotate board counter-clockwise"
          @click="rotateBoard(-1)"
        >
          Rotate left
        </UButton>
        <span class="text-xs text-slate-500">Only rotates your view</span>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          trailing-icon="i-lucide-rotate-cw"
          aria-label="Rotate board clockwise"
          @click="rotateBoard(1)"
        >
          Rotate right
        </UButton>
      </div>
      <BoggleBoard
        :board="gameView.board"
        :color="gameView.board.backgroundColor"
        :rotation="boardRotation"
        :selected-path="selectedPath"
        viewport-fit
        class="mt-2"
        @select="selectTile"
      />
    </section>

    <aside class="space-y-5">
      <div class="game-panel rounded-xl p-5">
        <h2 class="font-display text-xl font-bold">
          Word counts
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          Words and scores stay hidden until time is up.
        </p>
        <MatchPlayerList
          :members="match.members"
          :viewer-member-id="match.viewerMemberId"
          active
          class="mt-3"
        />
        <UButton
          v-if="isHost"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-octagon-x"
          class="mt-4"
          @click="endMatch"
        >
          End match
        </UButton>
      </div>
      <div class="rounded-xl bg-primary-50 p-5">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold">
            Your words
          </h2><UBadge variant="soft">
            {{ gameView.submittedWords?.length ?? 0 }}
          </UBadge>
        </div>
        <div
          v-if="gameView.submittedWords?.length"
          class="mt-3 flex flex-wrap gap-2"
        >
          <UBadge
            v-for="submitted in gameView.submittedWords"
            :key="submitted"
            color="neutral"
            variant="soft"
            class="font-mono uppercase"
          >
            {{ submitted }}
          </UBadge>
        </div>
        <p
          v-else
          class="mt-3 text-sm text-slate-500"
        >
          Accepted words will appear here.
        </p>
      </div>
    </aside>
  </div>
</template>
