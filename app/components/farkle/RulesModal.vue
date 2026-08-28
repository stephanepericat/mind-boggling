<script setup lang="ts">
import { FARKLE_RULES } from '#shared/games/farkle/rules'

const props = defineProps<{ targetScore: 1000 | 5000 | 10000 }>()
const open = defineModel<boolean>('open', { default: false })
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
  <UModal
    v-model:open="open"
    title="Complete Farkle rules"
    description="Classic.v1 · the rules used at this table"
  >
    <template #body>
      <dl class="space-y-5 text-sm">
        <div
          v-for="([title, description]) in playRules"
          :key="title"
        >
          <dt class="font-bold text-slate-950">
            {{ title }}
          </dt>
          <dd class="mt-1 leading-relaxed text-slate-600">
            {{ description }}
          </dd>
        </div>
      </dl>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full justify-end">
        <UButton @click="close">
          Back to the game
        </UButton>
      </div>
    </template>
  </UModal>
</template>
