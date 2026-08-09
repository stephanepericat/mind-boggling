<script setup lang="ts">
import type { MatchView } from '../../../shared/types/api'

const props = defineProps<{ match: MatchView }>()
const emit = defineEmits<{ continue: [] }>()
const isHost = computed(() => props.match.viewerMemberId === props.match.hostMemberId)
const isLastRound = computed(() => props.match.currentRound >= props.match.settings.rounds)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_23rem]">
    <section class="game-panel rounded-xl p-6 sm:p-8">
      <UBadge variant="soft">
        Round {{ match.currentRound }} complete
      </UBadge>
      <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight">
        Words on the table.
      </h1>
      <p class="mt-2 text-slate-600">
        Duplicates cancel for everyone. Unique valid words earn points.
      </p>

      <div class="mt-7 space-y-5">
        <article
          v-for="score in match.roundScores"
          :key="score.memberId"
          class="rounded-xl border border-slate-200 p-5"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-bold">
                {{ score.displayName }}
              </h2><p class="text-sm text-slate-500">
                {{ score.words.length }} accepted words
              </p>
            </div>
            <p class="font-mono text-2xl font-black">
              +{{ score.points }} <small class="text-xs font-medium text-slate-400">pts</small>
            </p>
          </div>
          <div
            v-if="score.words.length"
            class="mt-4 flex flex-wrap gap-2"
          >
            <span
              v-for="entry in score.words"
              :key="entry.word"
              class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs font-bold uppercase"
              :class="entry.duplicate ? 'bg-amber-50 text-amber-800 line-through' : 'bg-emerald-50 text-emerald-700'"
            >
              {{ entry.word }} <span class="text-[10px] opacity-70">{{ entry.duplicate ? 'duplicate' : `+${entry.points}` }}</span>
            </span>
          </div>
          <p
            v-else
            class="mt-4 text-sm text-slate-500"
          >
            No valid words this round.
          </p>
        </article>
      </div>

      <div class="mt-7 flex items-center justify-between border-t border-slate-200 pt-6">
        <p class="text-sm text-slate-500">
          {{ isLastRound ? 'Ready for the final scoreboard.' : `${match.settings.rounds - match.currentRound} rounds remaining.` }}
        </p>
        <UButton
          v-if="isHost"
          size="lg"
          trailing-icon="i-lucide-arrow-right"
          @click="emit('continue')"
        >
          {{ isLastRound ? 'Finish match' : 'Start next round' }}
        </UButton>
        <p
          v-else
          class="text-sm font-semibold"
        >
          Waiting for the host…
        </p>
      </div>
    </section>

    <aside>
      <MatchScoreboard
        :members="match.members"
        title="Overall standings"
      />
    </aside>
  </div>
</template>
