<script setup lang="ts">
import type { RolledDie } from '../../../shared/dice/types'

const props = defineProps<{
  dice: RolledDie<number>[]
  rollId: string
  selectedDieIds: string[]
  disabled?: boolean
}>()
const emit = defineEmits<{ toggle: [dieId: string] }>()

const selection = computed(() => new Set(props.selectedDieIds))
</script>

<template>
  <div>
    <DiceDiceScene
      :dice="dice"
      :roll-id="rollId"
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
        class="grid aspect-square min-h-14 place-items-center rounded-xl border bg-white font-mono text-3xl font-black shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed"
        :class="selection.has(die.id) ? 'border-2 border-primary-600 bg-primary-50 text-primary-700 -translate-y-1' : 'border-slate-200 text-slate-900 hover:border-slate-400'"
        @click="emit('toggle', die.id)"
      >
        {{ die.face }}
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
