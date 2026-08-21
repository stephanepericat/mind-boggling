<script setup lang="ts">
import type { GameKey } from '../../../shared/games/contract'
import type { AllTimeBestResponse } from '../../../shared/types/api'

const selectedGameKey = shallowRef<GameKey>('boggle.v1')
const query = computed(() => ({ gameKey: selectedGameKey.value }))
const { data, status, error, refresh } = await useFetch<AllTimeBestResponse>('/api/leaderboard', {
  query,
  cache: 'no-store',
  getCachedData(key, nuxtApp) {
    return nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined
  }
})
const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const gameOptions = computed(() => (data.value?.games ?? []).map(game => ({ label: game.name, value: game.key })))

function rankColor(rank: number): 'primary' | 'warning' | 'neutral' {
  if (rank === 1) return 'primary'
  if (rank === 3) return 'warning'
  return 'neutral'
}
</script>

<template>
  <div>
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 class="font-display text-2xl font-bold">
          Top 10 scores
        </h2>
        <p class="mt-1 text-sm text-slate-600">
          The highest individual match scores across all players.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <UFormField
          label="Game"
          class="w-44"
        >
          <USelect
            v-model="selectedGameKey"
            :items="gameOptions"
            value-key="value"
            class="w-full"
            aria-label="Filter all-time best scores by game"
          />
        </UFormField>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div
      v-if="status === 'pending' && !data"
      class="mt-6 grid min-h-64 place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-7 animate-spin text-primary-600"
      />
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      title="Leaderboard unavailable"
      description="The all-time best scores could not be loaded."
      class="mt-6"
    />
    <div
      v-else-if="data?.entries.length"
      class="game-panel mt-6 overflow-hidden rounded-xl"
      :class="status === 'pending' ? 'opacity-60' : ''"
      aria-live="polite"
    >
      <div class="hidden grid-cols-[5rem_1fr_1.2fr_9rem_8rem] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
        <span>Rank</span><span>Player</span><span>Match</span><span>Date</span><span class="text-right">Score</span>
      </div>
      <div
        v-for="entry in data.entries"
        :key="`${entry.matchId}:${entry.playerId}`"
        class="grid gap-3 border-b border-slate-200 px-6 py-5 last:border-0 sm:grid-cols-[5rem_1fr_1.2fr_9rem_8rem] sm:items-center sm:gap-4"
      >
        <UBadge
          :color="rankColor(entry.rank)"
          variant="soft"
          class="w-fit font-mono"
        >
          #{{ entry.rank }}
        </UBadge>
        <p class="font-display text-lg font-bold">
          {{ entry.playerName }}
        </p>
        <div>
          <p class="font-semibold">
            {{ entry.matchName }}
          </p>
          <p class="mt-0.5 text-xs text-slate-500 sm:hidden">
            {{ formatter.format(new Date(entry.achievedAt)) }}
          </p>
        </div>
        <p class="hidden text-sm text-slate-500 sm:block">
          {{ formatter.format(new Date(entry.achievedAt)) }}
        </p>
        <p class="font-mono text-xl font-black sm:text-right">
          {{ entry.score }} <small class="text-xs font-medium text-slate-400">pts</small>
        </p>
      </div>
    </div>
    <div
      v-else
      class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"
    >
      <UIcon
        name="i-lucide-medal"
        class="mx-auto size-8 text-slate-400"
      />
      <h2 class="mt-4 font-display text-xl font-bold">
        No scores yet
      </h2>
      <p class="mt-2 text-sm text-slate-500">
        Completed matches will fill the all-time leaderboard.
      </p>
    </div>
  </div>
</template>
