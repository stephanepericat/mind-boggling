<script setup lang="ts">
import type { BoggleSettings } from '../../../shared/games/boggle'
import { BOGGLE_BOARD_COLOR_OPTIONS, getBoggleBoardColorOption } from '../../utils/boggleBoardColor'

const toast = useToast()
const submitting = ref(false)
const matchName = ref('Family game night')
const settings = reactive<BoggleSettings>({
  boardSize: 4,
  boardColor: 'random',
  roundSeconds: 180,
  minWordLength: 3,
  rounds: 3,
  countdownWarning: true,
  locale: 'en-US'
})

const options = [
  { key: 'boardSize' as const, title: 'Board size', help: 'Choose how many letter tiles are in play.', values: [{ label: '4 × 4', value: 4 }, { label: '5 × 5', value: 5 }, { label: '6 × 6', value: 6 }, { label: '7 × 7', value: 7 }] },
  { key: 'roundSeconds' as const, title: 'Round time', help: 'Longer rounds give larger boards room to breathe.', values: [{ label: '3 minutes', value: 180 }, { label: '4 minutes', value: 240 }, { label: '5 minutes', value: 300 }] },
  { key: 'minWordLength' as const, title: 'Minimum valid word', help: 'Words shorter than this do not score.', values: [{ label: '2 characters', value: 2 }, { label: '3 characters', value: 3 }, { label: '4 characters', value: 4 }] },
  { key: 'rounds' as const, title: 'Rounds', help: 'Scores accumulate across the full match.', values: [1, 2, 3, 4, 5].map(value => ({ label: String(value), value })) }
]

const selectedBoardColor = computed(() => getBoggleBoardColorOption(settings.boardColor))
const previewLetters = ['B', 'O', 'G', 'G', 'L', 'E', 'N', 'I', 'G', 'H', 'T', 'S', 'A', 'M', 'E', 'S']

async function submit() {
  submitting.value = true
  try {
    const result = await $fetch<{ matchId: string, inviteUrl: string }>('/api/matches', {
      method: 'POST',
      body: { name: matchName.value, settings }
    })
    sessionStorage.setItem(`mind-boggling:invite:${result.matchId}`, result.inviteUrl)
    await navigateTo(`/matches/${result.matchId}`)
  } catch (error) {
    toast.add({ title: 'Match not created', description: error instanceof Error ? error.message : 'Try again.', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1180px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <UButton
      to="/"
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      class="-ml-3 mb-5"
    >
      Back to games
    </UButton>
    <div class="mb-8">
      <UBadge variant="soft">
        Boggle · private match
      </UBadge>
      <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight">
        Set up tonight’s match
      </h1>
      <p class="mt-2 text-slate-600">
        Everyone will see these rules in the lobby before play starts.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_25rem]">
      <form
        class="game-panel rounded-xl p-6"
        @submit.prevent="submit"
      >
        <UFormField
          label="Match name"
          required
        >
          <UInput
            v-model="matchName"
            maxlength="48"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <fieldset
          v-for="option in options"
          :key="option.key"
          class="mt-5 border-t border-slate-200 pt-4"
        >
          <legend class="sr-only">
            {{ option.title }}
          </legend>
          <p class="text-sm font-bold">
            {{ option.title }}
          </p>
          <p class="mt-0.5 text-xs text-slate-500">
            {{ option.help }}
          </p>
          <div
            class="mt-3 flex gap-2"
            :class="option.key === 'rounds' ? 'grid grid-cols-5' : ''"
          >
            <button
              v-for="choice in option.values"
              :key="choice.value"
              type="button"
              :aria-pressed="settings[option.key] === choice.value"
              class="min-h-11 flex-1 rounded-lg border px-3 font-mono text-xs font-bold transition"
              :class="settings[option.key] === choice.value ? 'border-2 border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400'"
              @click="(settings[option.key] as number) = choice.value"
            >
              {{ choice.label }}
            </button>
          </div>
        </fieldset>

        <fieldset class="mt-5 border-t border-slate-200 pt-4">
          <legend class="text-sm font-bold">
            Board color
          </legend>
          <p class="mt-0.5 text-xs text-slate-500">
            Choose one background for every round, or let each round pick a random color.
          </p>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="choice in BOGGLE_BOARD_COLOR_OPTIONS"
              :key="choice.value"
              type="button"
              :aria-pressed="settings.boardColor === choice.value"
              class="flex min-h-11 items-center gap-2 rounded-lg border bg-slate-50 px-3 text-left text-xs font-bold transition"
              :class="settings.boardColor === choice.value ? 'border-2 border-primary-600 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-400'"
              @click="settings.boardColor = choice.value"
            >
              <span
                class="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                :class="choice.backgroundClass"
                aria-hidden="true"
              />
              {{ choice.label }}
            </button>
          </div>
        </fieldset>

        <div class="mt-5 border-t border-slate-200 pt-5">
          <USwitch
            v-model="settings.countdownWarning"
            label="10-second countdown warning"
            description="Show a prominent countdown and play a short tone during the final ten seconds of each round."
          />
        </div>

        <div class="mt-6 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
          <p class="text-xs text-slate-500">
            <UIcon
              name="i-lucide-lock"
              class="mr-1 inline size-3.5"
            />The match will not appear publicly.
          </p>
          <UButton
            type="submit"
            size="lg"
            trailing-icon="i-lucide-arrow-right"
            :loading="submitting"
          >
            Create private match
          </UButton>
        </div>
      </form>

      <aside class="rounded-xl bg-primary-50 p-6">
        <div class="flex items-center justify-between">
          <p class="font-display text-lg font-bold">
            Match preview
          </p><UBadge
            color="neutral"
            variant="soft"
          >
            en-US
          </UBadge>
        </div>
        <div
          class="mt-6 grid aspect-square grid-cols-4 gap-2 rounded-xl p-4 shadow-sm transition-colors"
          :class="selectedBoardColor.backgroundClass"
          aria-hidden="true"
        >
          <span
            v-for="(letter, index) in previewLetters"
            :key="`${letter}-${index}`"
            class="grid place-items-center rounded-md border border-slate-200 bg-white font-mono text-lg font-black"
          >{{ letter }}</span>
        </div>
        <dl class="mt-6 space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-600">
              Board
            </dt><dd class="font-mono font-bold">
              {{ settings.boardSize }} × {{ settings.boardSize }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">
              Board color
            </dt><dd class="font-mono font-bold">
              {{ selectedBoardColor.label }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">
              Each round
            </dt><dd class="font-mono font-bold">
              {{ settings.roundSeconds / 60 }} min
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">
              Minimum word
            </dt><dd class="font-mono font-bold">
              {{ settings.minWordLength }} chars
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">
              Match
            </dt><dd class="font-mono font-bold">
              {{ settings.rounds }} rounds
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-600">
              Countdown warning
            </dt><dd class="font-mono font-bold">
              {{ settings.countdownWarning ? 'On' : 'Off' }}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  </div>
</template>
