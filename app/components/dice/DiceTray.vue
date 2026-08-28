<script setup lang="ts">
import type { RolledDie } from '../../../shared/dice/types'
import type { DiceAppearance } from '../../utils/diceAppearance'

const props = defineProps<{
  dice: RolledDie<number>[]
  rollId: string
  selectedDieIds: string[]
  disabled?: boolean
  appearance?: DiceAppearance
}>()
const emit = defineEmits<{ toggle: [dieId: string] }>()

const selection = computed(() => new Set(props.selectedDieIds))
const appearance = computed(() => props.appearance ?? { bodyColor: '#fffdf7', pipColor: '#172033' })
</script>

<template>
  <div>
    <DiceScene
      :dice="dice"
      :roll-id="rollId"
      :body-color="appearance.bodyColor"
      :pip-color="appearance.pipColor"
    />
    <div
      class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6"
      role="group"
      aria-label="Rolled dice. Select dice to score."
    >
      <button
        v-for="die in dice"
        :key="die.id"
        type="button"
        :disabled="disabled"
        :aria-label="`Die showing ${die.face}${selection.has(die.id) ? ', selected' : ''}`"
        :aria-pressed="selection.has(die.id)"
        class="grid aspect-square min-h-14 place-items-center rounded-xl border font-mono text-3xl font-black shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed"
        :class="selection.has(die.id) ? '-translate-y-1 border-transparent ring-2 ring-primary-500 ring-offset-2' : 'border-black/10 hover:border-slate-400'"
        :style="{ backgroundColor: appearance.bodyColor, color: appearance.pipColor }"
        @click="emit('toggle', die.id)"
      >
        <DicePips :face="die.face" />
      </button>
    </div>
    <p
      class="sr-only"
      aria-live="polite"
    >
      Roll result: {{ dice.map(die => die.face).join(', ') }}
    </p>
  </div>
</template>
