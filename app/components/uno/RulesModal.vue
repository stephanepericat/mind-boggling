<script setup lang="ts">
import type { UnoTargetScore } from '#shared/games/uno'

const props = defineProps<{ targetScore: UnoTargetScore }>()
const open = defineModel<boolean>('open', { default: false })
const format = new Intl.NumberFormat('en-US')

const rules = computed(() => [
  ['Table', 'Two to eight players each begin with seven cards from the classic 108-card deck.'],
  ['Play', 'Match the top discard by color, number, or action symbol. A Wild matches anything.'],
  ['Drawing', 'You may draw even with a playable card. After drawing, you may play only that new card or pass.'],
  ['Draw Two', 'The next player draws two cards and loses their turn. Penalty cards do not stack.'],
  ['Reverse and Skip', 'Reverse changes direction and Skip removes the next turn. With two players, either card returns play to you.'],
  ['Wild', 'Choose any active color, including the current color.'],
  ['Wild Draw Four', 'Play it only when you have no card matching the active color. The affected player may accept four or challenge. The server checks legality without revealing your hand.'],
  ['Call UNO', 'Declare UNO when playing down to one card. You can arm the call before playing your next-to-last card. If you forget, call it before another player catches you.'],
  ['Catch a missed UNO', 'When another player reaches one card without calling UNO, a red Catch button appears on their seat and beside your turn controls. Select it before the next player plays or draws; a successful catch makes that player draw two.'],
  ['Scoring', 'The round winner scores every card left in opponents’ hands: numbers at face value, colored actions at 20, and Wilds at 50.'],
  ['Winning', `The first player to reach ${format.format(props.targetScore)} points wins this match.`],
  ['Disconnected player', 'After 60 seconds, the host may resolve a disconnected turn as a legal draw and pass. A disconnected host may be resolved by another player.']
] as const)
</script>

<template>
  <UModal
    v-model:open="open"
    title="Complete UNO rules"
    description="Classic 108-card rules · no stacking or house rules"
  >
    <template #body>
      <dl class="space-y-5 text-sm">
        <div
          v-for="([title, description]) in rules"
          :key="title"
        >
          <dt class="font-bold text-slate-950 dark:text-white">
            {{ title }}
          </dt>
          <dd class="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            {{ description }}
          </dd>
        </div>
      </dl>
      <UButton
        class="mt-6"
        to="https://service.mattel.com/instruction_sheets/B0001-Eng.pdf"
        target="_blank"
        color="neutral"
        variant="outline"
        trailing-icon="i-lucide-external-link"
      >
        Mattel rule sheet
      </UButton>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end">
        <UButton @click="close">
          Back to the table
        </UButton>
      </div>
    </template>
  </UModal>
</template>
