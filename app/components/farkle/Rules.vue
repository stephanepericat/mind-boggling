<script setup lang="ts">
import { FARKLE_RULES, FARKLE_SCORE_TABLE } from '#shared/games/farkle/rules'

const props = defineProps<{ targetScore: 1000 | 5000 | 10000 }>()
const format = new Intl.NumberFormat('en-US')

const playRules = computed(() => [
  ['Table', '2–8 players use six fair six-sided dice.'],
  ['Starting player', 'Everyone rolls one die. Highest roll starts; only tied leaders reroll.'],
  ['Turn order', 'Play follows lobby join order, rotated so the high-roll winner goes first.'],
  ['Your turn', 'Roll all available dice, then select only dice that form a legal scoring group. Bank them or keep rolling the remaining dice.'],
  ['Entry score', `Your first bank must be at least ${format.format(FARKLE_RULES.openingThreshold)} points. The threshold does not change with the winning score.`],
  ['Hot dice', 'If every available die scores, you keep the turn total and roll all six dice again.'],
  ['Farkle', 'A roll with no scoring dice ends the turn and loses every unbanked point from that turn.'],
  ['Winning score', `Banking ${format.format(props.targetScore)} or more triggers one final turn for every other player.`],
  ['Final turns', 'Every opponent gets exactly one final turn and may overtake the player who triggered the finale.'],
  ['Ties', 'Tied leaders each play a complete sudden-death turn. New tied leaders repeat until one player leads.'],
  ['Disconnected player', 'After 60 seconds disconnected, the host may skip a player. If the host is disconnected, any connected non-active player may skip them. The skipped turn scores zero.']
] as const)
</script>

<template>
  <section class="overflow-hidden rounded-xl bg-slate-950 text-white">
    <div class="p-5">
      <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">
        Classic.v1
      </p>
      <h2 class="mt-1 font-display text-xl font-bold">
        Complete rules
      </h2>
      <dl class="mt-5 space-y-4 text-sm">
        <div
          v-for="([title, description]) in playRules"
          :key="title"
        >
          <dt class="font-bold text-white">
            {{ title }}
          </dt>
          <dd class="mt-1 leading-relaxed text-slate-300">
            {{ description }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="border-t border-white/10 p-5">
      <h3 class="font-display text-lg font-bold">
        Complete scoring
      </h3>
      <table class="mt-3 w-full text-left text-sm">
        <thead class="sr-only">
          <tr><th>Selection</th><th>Score</th></tr>
        </thead>
        <tbody class="divide-y divide-white/10">
          <tr
            v-for="rule in FARKLE_SCORE_TABLE"
            :key="rule.selection"
          >
            <td class="py-2 pr-3 text-slate-300">
              {{ rule.selection }}
            </td>
            <td class="py-2 text-right font-mono font-bold text-white">
              {{ format.format(rule.score) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
        Scoring groups cannot cross roll boundaries. You may keep any legal scoring subset; you do not have to take the highest immediate score. Three 1s score 300—not 1,000—in this ruleset.
      </p>
    </div>
  </section>
</template>
