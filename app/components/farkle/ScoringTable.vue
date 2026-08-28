<script setup lang="ts">
import { FARKLE_SCORE_TABLE } from '#shared/games/farkle/rules'

const format = new Intl.NumberFormat('en-US')
</script>

<template>
  <section class="overflow-hidden rounded-xl bg-slate-950 p-5 text-white">
    <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">
      Classic.v1
    </p>
    <h2 class="mt-1 font-display text-xl font-bold">
      Complete scoring
    </h2>
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
  </section>
</template>
