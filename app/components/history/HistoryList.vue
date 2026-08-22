<script setup lang="ts">
import { sortMatchHistory } from '../../utils/matchHistory'
import type { MatchHistorySort } from '../../utils/matchHistory'

const { data, status, error, refresh } = await useMatchHistory('/api/history')
const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const ordinal = new Intl.PluralRules('en-US', { type: 'ordinal' })
const sortBy = shallowRef<MatchHistorySort>('date')
const sortOptions = [
  { label: 'Date', value: 'date' },
  { label: 'Score', value: 'score' }
] satisfies Array<{ label: string, value: MatchHistorySort }>
const sortedMatches = computed(() => sortMatchHistory(data.value?.matches ?? [], sortBy.value))

function placement(value: number): string {
  const rule = ordinal.select(value)
  const suffix = rule === 'one' ? 'st' : rule === 'two' ? 'nd' : rule === 'few' ? 'rd' : 'th'
  return `${value}${suffix}`
}
</script>

<template>
  <div>
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 class="font-display text-2xl font-bold">
          Your completed matches
        </h2>
        <p class="mt-1 text-sm text-slate-600">
          Only games you played appear in this list.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <UFormField
          label="Sort by"
          class="w-36"
        >
          <USelect
            v-model="sortBy"
            :items="sortOptions"
            value-key="value"
            class="w-full"
            aria-label="Sort match history by"
          />
        </UFormField>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          @click="refresh()"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div
      v-if="status === 'pending'"
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
      title="History unavailable"
      description="Your completed matches could not be loaded."
      class="mt-6"
    />
    <div
      v-else-if="data?.matches.length"
      class="game-panel mt-6 overflow-hidden rounded-xl"
    >
      <div class="hidden grid-cols-[1.2fr_1fr_8rem_8rem] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid">
        <span>Match</span><span>Players</span><span>Place</span><span class="text-right">Score</span>
      </div>
      <NuxtLink
        v-for="match in sortedMatches"
        :key="match.matchId"
        :to="`/matches/${match.matchId}`"
        class="grid gap-4 border-b border-slate-200 px-6 py-5 last:border-0 hover:bg-slate-50 sm:grid-cols-[1.2fr_1fr_8rem_8rem] sm:items-center"
      >
        <div><p class="font-display text-lg font-bold">{{ match.matchName }}</p><p class="mt-1 text-xs text-slate-500">{{ match.gameName }} · {{ formatter.format(new Date(match.completedAt)) }}</p></div>
        <p class="truncate text-sm text-slate-600">{{ match.participants.join(', ') }}</p>
        <UBadge
          :color="match.placement === 1 ? 'primary' : 'neutral'"
          variant="soft"
          class="w-fit"
        >{{ placement(match.placement) }}</UBadge>
        <p class="font-mono text-xl font-black sm:text-right">{{ match.score }} <small class="text-xs font-medium text-slate-400">pts</small></p>
      </NuxtLink>
    </div>
    <div
      v-else
      class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"
    >
      <UIcon
        name="i-lucide-trophy"
        class="mx-auto size-8 text-slate-400"
      /><h2 class="mt-4 font-display text-xl font-bold">
        No completed matches yet
      </h2><p class="mt-2 text-sm text-slate-500">
        Your next game night will start the scoreboard.
      </p><UButton
        to="/"
        class="mt-6"
      >
        Choose a game
      </UButton>
    </div>
  </div>
</template>
