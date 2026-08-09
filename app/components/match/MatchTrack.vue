<script setup lang="ts">
import type { MatchStatus } from '../../../shared/types/api'

const props = defineProps<{ status: MatchStatus, currentRound: number, rounds: number }>()

const stages = computed(() => {
  const round = Math.max(props.currentRound, 1)
  return [
    { label: 'Invite', complete: true, active: false },
    { label: 'Lobby', complete: props.status !== 'lobby', active: props.status === 'lobby' },
    { label: `Round ${round}`, complete: ['round_results', 'finished'].includes(props.status), active: props.status === 'active' },
    { label: props.currentRound < props.rounds ? 'Next round' : 'Results', complete: props.status === 'finished', active: props.status === 'round_results' },
    { label: 'Final', complete: false, active: props.status === 'finished' }
  ]
})
</script>

<template>
  <ol
    class="flex min-w-max items-center gap-2"
    aria-label="Match progress"
  >
    <li
      v-for="(stage, index) in stages"
      :key="`${stage.label}-${index}`"
      class="flex items-center gap-2"
    >
      <span
        class="grid size-7 place-items-center rounded-full border font-mono text-[10px] font-bold"
        :class="stage.active ? 'border-primary-600 bg-primary-600 text-white' : stage.complete ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-300 bg-white text-slate-500'"
      >
        <UIcon
          v-if="stage.complete"
          name="i-lucide-check"
          class="size-3.5"
        />
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span
        class="text-xs font-semibold"
        :class="stage.active ? 'text-slate-950' : 'text-slate-500'"
      >{{ stage.label }}</span>
      <span
        v-if="index < stages.length - 1"
        class="h-px w-5 bg-slate-300"
      />
    </li>
  </ol>
</template>
