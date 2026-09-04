<script setup lang="ts">
import type { UnoMatchView } from '../../../shared/types/api'

const props = defineProps<{ match: UnoMatchView }>()
const emit = defineEmits<{ continue: [] }>()
const result = computed(() => props.match.game.view.roundResult)
const isHost = computed(() => props.match.viewerMemberId === props.match.hostMemberId)
const winnerName = computed(() => memberName(result.value?.winnerMemberId))

function memberName(memberId?: string): string {
  return props.match.members.find(member => member.id === memberId)?.displayName ?? 'Player'
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_23rem]">
    <section class="overflow-hidden rounded-2xl bg-[#11151D] text-white shadow-xl">
      <div class="p-6 sm:p-9">
        <UBadge
          color="warning"
          variant="soft"
        >
          Round {{ result?.roundNumber }} settled
        </UBadge>
        <h1 class="mt-4 font-display text-4xl font-black tracking-tight sm:text-5xl">
          {{ winnerName }} cleared the hand.
        </h1>
        <p class="mt-3 text-slate-300">
          Every card left at the table becomes <span class="font-mono font-bold text-[#FFC928]">+{{ result?.points ?? 0 }}</span> points.
        </p>

        <div class="mt-8 grid gap-4 sm:grid-cols-2">
          <article
            v-for="hand in result?.hands"
            :key="hand.memberId"
            class="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="font-display text-lg font-bold">
                  {{ memberName(hand.memberId) }}
                </h2>
                <p class="text-xs text-slate-400">
                  {{ hand.cards.length }} cards remaining
                </p>
              </div>
              <span class="font-mono text-xl font-black">{{ hand.points }} pts</span>
            </div>
            <div
              v-if="hand.cards.length"
              class="mt-4 flex gap-1 overflow-x-auto pb-2"
            >
              <UnoCard
                v-for="card in hand.cards"
                :key="card.id"
                :card="card"
                compact
                display-only
              />
            </div>
            <p
              v-else
              class="mt-4 text-sm font-bold text-emerald-300"
            >
              Out of cards
            </p>
          </article>
        </div>

        <div class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p class="text-sm text-slate-400">
            First to {{ match.game.settings.targetScore.toLocaleString() }} points wins.
          </p>
          <UButton
            v-if="isHost"
            size="lg"
            trailing-icon="i-lucide-layers-3"
            @click="emit('continue')"
          >
            Deal next round
          </UButton>
          <p
            v-else
            class="text-sm font-semibold"
          >
            Waiting for the host to deal…
          </p>
        </div>
      </div>
    </section>
    <MatchScoreboard
      :members="match.members"
      title="Overall standings"
    />
  </div>
</template>
