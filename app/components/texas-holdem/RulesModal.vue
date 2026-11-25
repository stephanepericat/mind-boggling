<script setup lang="ts">
import { HOLDEM_RULES } from '#shared/games/texas-holdem/rules'

defineProps<{ onFelt?: boolean }>()

const rankings = [
  'Royal flush', 'Straight flush', 'Four of a kind', 'Full house', 'Flush',
  'Straight', 'Three of a kind', 'Two pair', 'One pair', 'High card'
]
</script>

<template>
  <UModal
    title="Texas Hold’em rules"
    description="No-limit Hold’em with free play chips"
    :ui="{ content: 'max-w-2xl', body: 'max-h-[65dvh] space-y-5 text-sm leading-relaxed' }"
  >
    <UButton
      type="button"
      icon="i-lucide-book-open"
      color="neutral"
      :variant="onFelt ? 'ghost' : 'outline'"
      :class="onFelt && 'holdem-rules-trigger'"
    >
      Game rules
    </UButton>

    <template #body>
      <section>
        <h3 class="mb-1 font-display text-lg font-bold">
          The deal
        </h3>
        <p>Everyone starts with {{ HOLDEM_RULES.startingStack.toLocaleString('en-US') }} chips and gets two private cards in each hand. The small and big blinds post forced bets before the deal. The table reveals three community cards on the flop, then one on the turn and one on the river. Betting happens before the flop and after each reveal.</p>
      </section>
      <section>
        <h3 class="mb-1 font-display text-lg font-bold">
          Your turn
        </h3>
        <p>Check when you owe nothing, or call to match the wager up to what you have left. Fold to give up the hand. A bet opens the action and a raise increases the wager. A full raise must be at least as large as the last full bet or raise. A short all-in can increase the call amount without reopening raises. With two players, the small blind acts first before the flop and last afterward.</p>
        <p class="mt-2">
          If your {{ HOLDEM_RULES.turnMs / 1000 }} seconds run out, the table checks when possible or folds for you.
        </p>
      </section>
      <section>
        <h3 class="mb-1 font-display text-lg font-bold">
          Winning a pot
        </h3>
        <p>The last player in a hand wins without showing cards. At showdown, make the best five-card hand using any combination of your private cards and the board. Equal hands split each pot. If a player goes all-in for less, the extra matched chips form a side pot for the players who contributed to it. Unmatched chips return to their owner.</p>
        <ol
          class="mt-3 grid list-decimal gap-x-6 gap-y-1 pl-5 sm:grid-flow-col sm:grid-rows-5 sm:grid-cols-2"
          aria-label="Hand rankings from strongest to weakest"
        >
          <li
            v-for="rank in rankings"
            :key="rank"
          >
            {{ rank }}
          </li>
        </ol>
      </section>
      <section>
        <h3 class="mb-1 font-display text-lg font-bold">
          Winning the match
        </h3>
        <p><strong>12 Hands</strong> uses fixed blinds. The biggest stack wins after 12 hands or when only one player has chips. Equal final stacks share a place.</p>
        <p class="mt-2">
          <strong>Tournament</strong> raises the blinds and runs until one player has chips. When two players are eliminated in the same hand, the larger stack at the start of that hand places higher. Equal starting stacks share a place.
        </p>
      </section>
    </template>

    <template #footer="{ close }">
      <UButton
        class="ml-auto"
        @click="close"
      >
        Done
      </UButton>
    </template>
  </UModal>
</template>

<style scoped>
.holdem-rules-trigger {
  color: #f9e9c9;
  border: 1px solid #f9e9c951;
}
.holdem-rules-trigger:hover { background: #eef5ff1c; }
.holdem-rules-trigger:focus-visible { outline-color: #f4c574; }
</style>
