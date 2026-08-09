<script setup lang="ts">
import type { MatchView } from '../../../shared/types/api'

const props = defineProps<{ match: MatchView, serverOffset: number, connected: boolean }>()
const emit = defineEmits<{ submit: [word: string, path?: number[]], end: [] }>()

const now = ref(Date.now())
const word = ref('')
const selectedPath = ref<number[]>([])
let timer: ReturnType<typeof setInterval> | null = null

const remainingSeconds = computed(() => Math.max(0, Math.ceil(((props.match.roundEndsAt ?? now.value) - (now.value + props.serverOffset)) / 1000)))
const minutes = computed(() => Math.floor(remainingSeconds.value / 60))
const seconds = computed(() => remainingSeconds.value % 60)
const progress = computed(() => remainingSeconds.value / props.match.settings.roundSeconds * 100)
const isHost = computed(() => props.match.members.find(member => member.id === props.match.viewerMemberId)?.role === 'host')

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
  const tile = props.match.board?.tiles[tileId]
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

function endMatch() {
  if (window.confirm('End the match now? The current round will be scored.')) emit('end')
}
</script>

<template>
  <div
    v-if="match.board"
    class="grid gap-6 xl:grid-cols-[1fr_21rem]"
  >
    <section>
      <div class="mb-5 flex items-center justify-between gap-4 rounded-xl bg-slate-950 px-5 py-4 text-white">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-primary-300">
            Round {{ match.currentRound }} of {{ match.settings.rounds }}
          </p><p class="mt-1 text-sm text-slate-300">
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
      <UProgress
        :model-value="progress"
        size="sm"
        class="mb-5"
      />
      <BoggleBoard
        :board="match.board"
        :selected-path="selectedPath"
        @select="selectTile"
      />
      <form
        class="mx-auto mt-5 flex max-w-[38rem] gap-2"
        @submit.prevent="submit"
      >
        <UInput
          v-model="word"
          size="xl"
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
      <div class="mx-auto mt-3 flex max-w-[38rem] items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          class="underline underline-offset-2"
          @click="word = ''; selectedPath = []"
        >
          Clear selection
        </button>
        <span>Minimum {{ match.settings.minWordLength }} letters · Qu counts as two</span>
      </div>
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
            {{ match.submittedWords?.length ?? 0 }}
          </UBadge>
        </div>
        <div
          v-if="match.submittedWords?.length"
          class="mt-3 flex flex-wrap gap-2"
        >
          <UBadge
            v-for="submitted in match.submittedWords"
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
