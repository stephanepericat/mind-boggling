<script setup lang="ts">
import type { NumericRolledDie } from '#shared/games/farkle/types'
import type { DiceAppearance } from '../../utils/diceAppearance'

const props = defineProps<{
  dice: readonly NumericRolledDie[]
  playerName: string
  rollId: string
  appearance: DiceAppearance
}>()

const taunts = [
  'The dice said: absolutely not.',
  'Six tiny cubes. Zero useful ideas.',
  'A daring roll with no points to show for it.',
  'The table sends its regards.'
]
const taunt = computed(() => {
  let hash = 0
  for (const character of props.rollId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return taunts[hash % taunts.length]
})
</script>

<template>
  <div
    class="absolute inset-0 z-30 grid place-items-center bg-slate-950/95 p-6 text-white backdrop-blur-sm"
    role="status"
    aria-live="assertive"
  >
    <div class="w-full max-w-3xl text-center">
      <div class="farkle-tag mx-auto w-fit -rotate-3 rounded-md bg-amber-300 px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg">
        Nice try
      </div>
      <h2 class="farkle-slam mt-3 font-display text-6xl font-black tracking-[-0.06em] text-white sm:text-8xl">
        FARKLE!
      </h2>
      <p class="mt-2 text-lg font-semibold text-slate-200">
        {{ playerName }} loses every unbanked point.
      </p>
      <DiceScene
        :dice="dice"
        :roll-id="rollId"
        :body-color="appearance.bodyColor"
        :pip-color="appearance.pipColor"
        class="farkle-dice mt-3"
      />
      <p class="farkle-taunt mt-2 font-display text-xl font-bold text-primary-200">
        {{ taunt }}
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes farkle-slam {
  0% { opacity: 0; transform: scale(2.2) rotate(-7deg); filter: blur(10px); }
  55% { opacity: 1; transform: scale(0.92) rotate(2deg); filter: blur(0); }
  72% { transform: scale(1.06) rotate(-1deg); }
  100% { transform: scale(1) rotate(0); }
}

@keyframes farkle-tag {
  0%, 42% { opacity: 0; transform: translateY(-1rem) rotate(-8deg); }
  65% { opacity: 1; transform: translateY(0.2rem) rotate(4deg); }
  100% { opacity: 1; transform: translateY(0) rotate(0); }
}

@keyframes farkle-taunt {
  0%, 70% { opacity: 0; transform: translateY(0.7rem); }
  100% { opacity: 1; transform: translateY(0); }
}

.farkle-slam { animation: farkle-slam 620ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.farkle-tag { animation: farkle-tag 760ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.farkle-dice { animation: farkle-taunt 780ms ease-out both; }
.farkle-taunt { animation: farkle-taunt 1.05s ease-out both; }

@media (prefers-reduced-motion: reduce) {
  .farkle-slam,
  .farkle-tag,
  .farkle-dice,
  .farkle-taunt { animation: none; }
}
</style>
