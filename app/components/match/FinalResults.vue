<script setup lang="ts">
import type { MatchView } from '../../../shared/types/api'

const props = defineProps<{ match: MatchView }>()
const winner = computed(() => [...props.match.members].sort((left, right) => (right.cumulativeScore ?? 0) - (left.cumulativeScore ?? 0))[0])
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_25rem]">
    <section class="overflow-hidden rounded-xl bg-primary-600 text-white shadow-lg">
      <div class="p-8 sm:p-12">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary-100">
          Final scoreboard
        </p>
        <h1 class="mt-3 font-display text-5xl font-extrabold tracking-tight">
          {{ winner?.displayName }} wins!
        </h1>
        <p class="mt-4 max-w-xl text-primary-100">
          {{ match.settings.rounds }} rounds, one shared board at a time, and every duplicate settled.
        </p>
        <div class="mt-10 flex flex-wrap gap-3">
          <UButton
            to="/games/boggle/new"
            color="neutral"
            size="lg"
            icon="i-lucide-refresh-cw"
          >
            Play again
          </UButton>
          <UButton
            to="/history"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-history"
            class="border-white/40 text-white hover:bg-white/10"
          >
            Match history
          </UButton>
        </div>
      </div>
      <div class="grid grid-cols-3 border-t border-white/20 bg-primary-700/40">
        <div class="p-5">
          <p class="text-xs text-primary-200">
            Players
          </p><p class="mt-1 font-mono text-2xl font-black">
            {{ match.members.length }}
          </p>
        </div>
        <div class="border-x border-white/20 p-5">
          <p class="text-xs text-primary-200">
            Rounds
          </p><p class="mt-1 font-mono text-2xl font-black">
            {{ match.currentRound }}
          </p>
        </div>
        <div class="p-5">
          <p class="text-xs text-primary-200">
            Winning score
          </p><p class="mt-1 font-mono text-2xl font-black">
            {{ winner?.cumulativeScore ?? 0 }}
          </p>
        </div>
      </div>
    </section>
    <MatchScoreboard
      :members="match.members"
      title="Final standings"
    />
  </div>
</template>
