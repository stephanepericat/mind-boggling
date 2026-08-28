<script setup lang="ts">
import type { FarkleMatchView } from '../../../shared/types/api'
import { useDiceRollSound } from '../../composables/useDiceRollSound'
import { resolveDiceAppearance } from '../../utils/diceAppearance'

const props = defineProps<{ match: FarkleMatchView }>()
const emit = defineEmits<{ roll: [], start: [] }>()

const game = computed(() => props.match.game.view)
const currentRound = computed(() => game.value.openingRollRounds.at(-1))
const winner = computed(() => props.match.members.find(member => member.id === game.value.openingWinnerMemberId))
const rolledMemberIds = computed(() => new Set(Object.keys(currentRound.value?.valuesByMemberId ?? {})))
const canViewerRoll = computed(() => Boolean(
  !game.value.openingWinnerMemberId
  && currentRound.value?.tiedLeaderMemberIds.includes(props.match.viewerMemberId)
  && !rolledMemberIds.value.has(props.match.viewerMemberId)
))
const canViewerStart = computed(() => game.value.openingWinnerMemberId === props.match.viewerMemberId)
const dice = computed(() => Object.entries(currentRound.value?.valuesByMemberId ?? {}).map(([id, face]) => ({ id, face, faceIndex: face - 1 })))
const displayedMemberIds = computed(() => [...new Set([
  ...(currentRound.value?.tiedLeaderMemberIds ?? []),
  ...Object.keys(currentRound.value?.valuesByMemberId ?? {})
])])
const animationKey = computed(() => `${currentRound.value?.rollId ?? 'opening'}:${dice.value.map(die => `${die.id}-${die.face}`).join(':')}`)
const appearance = computed(() => resolveDiceAppearance(props.match.game.settings.diceColor, currentRound.value?.rollId ?? 'opening'))
const rollSoundEvent = computed(() => dice.value.length > 0
  ? { id: animationKey.value, diceCount: dice.value.length }
  : null)
const previousRounds = computed(() => game.value.openingRollRounds.slice(0, -1))

useDiceRollSound(rollSoundEvent)

function memberName(memberId: string): string {
  return props.match.members.find(member => member.id === memberId)?.displayName ?? 'Player'
}
</script>

<template>
  <div class="mx-auto flex min-h-[31rem] max-w-3xl flex-col justify-center">
    <div class="text-center">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
        Opening high roll · round {{ game.openingRollRounds.length }}
      </p>
      <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        {{ winner ? `${winner.displayName} rolled highest.` : 'Roll to see who starts.' }}
      </h1>
      <p class="mx-auto mt-3 max-w-xl text-slate-600">
        {{ winner ? 'The winning roll stays on the table until the winner starts the game.' : 'Every eligible player rolls one die. Highest roll starts; tied leaders roll again.' }}
      </p>
    </div>

    <div class="mt-7 min-h-40 rounded-2xl bg-slate-50 p-4 sm:p-6">
      <DiceScene
        v-if="dice.length"
        :dice="dice"
        :roll-id="animationKey"
        :body-color="appearance.bodyColor"
        :pip-color="appearance.pipColor"
      />
      <div
        v-else
        class="grid h-36 place-items-center text-center"
      >
        <UIcon
          name="i-lucide-dices"
          class="size-12 text-slate-300"
        />
      </div>
      <ul
        class="mt-3 grid gap-2 sm:grid-cols-2"
        aria-live="polite"
      >
        <li
          v-for="memberId in displayedMemberIds"
          :key="memberId"
          class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <span class="font-semibold">{{ memberName(memberId) }}</span>
          <span
            v-if="currentRound?.valuesByMemberId[memberId]"
            class="font-mono text-2xl font-black text-slate-900"
          >{{ currentRound.valuesByMemberId[memberId] }}</span>
          <span
            v-else
            class="text-sm text-slate-400"
          >Waiting to roll</span>
        </li>
      </ul>
    </div>

    <div class="mt-6 flex flex-col items-center gap-3">
      <UButton
        v-if="canViewerRoll"
        size="xl"
        icon="i-lucide-dices"
        @click="emit('roll')"
      >
        Roll for high score
      </UButton>
      <UButton
        v-else-if="canViewerStart"
        size="xl"
        trailing-icon="i-lucide-play"
        @click="emit('start')"
      >
        Start game
      </UButton>
      <p
        v-else
        class="text-sm font-medium text-slate-500"
      >
        {{ winner ? `Waiting for ${winner.displayName} to start the game.` : rolledMemberIds.has(match.viewerMemberId) ? 'Your roll is in. Waiting for the others.' : 'Only tied leaders roll this round.' }}
      </p>
    </div>

    <div
      v-if="previousRounds.length"
      class="mt-7 border-t border-slate-200 pt-5"
    >
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
        Earlier rounds
      </p>
      <ol class="mt-3 space-y-2">
        <li
          v-for="(round, index) in previousRounds"
          :key="round.rollId"
          class="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span class="font-semibold">Round {{ index + 1 }} · tie</span>
          <span class="font-mono text-slate-500">
            {{ Object.entries(round.valuesByMemberId).map(([id, face]) => `${memberName(id)} ${face}`).join(' · ') }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
