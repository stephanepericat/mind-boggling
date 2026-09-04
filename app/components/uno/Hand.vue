<script setup lang="ts">
import type { UnoCard } from '#shared/games/uno'

const props = defineProps<{
  cards: UnoCard[]
  playableCardIds: string[]
  drawnCardId?: string
}>()
const emit = defineEmits<{ play: [card: UnoCard] }>()
const hand = useTemplateRef<HTMLDivElement>('hand')
const playable = computed(() => new Set(props.playableCardIds))

function moveFocus(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const buttons = [...(hand.value?.querySelectorAll<HTMLButtonElement>('.uno-card') ?? [])]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0 || buttons.length === 0) return
  event.preventDefault()
  const offset = event.key === 'ArrowRight' ? 1 : -1
  buttons[(current + offset + buttons.length) % buttons.length]?.focus()
}
</script>

<template>
  <div
    ref="hand"
    class="uno-hand"
    role="group"
    aria-label="Your hand. Use left and right arrows to move between cards."
    @keydown="moveFocus"
  >
    <UnoCard
      v-for="card in cards"
      :key="card.id"
      :card="card"
      :playable="playable.has(card.id)"
      :selected="card.id === drawnCardId"
      @select="emit('play', $event)"
    />
  </div>
</template>

<style scoped>
.uno-hand {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  overflow-x: auto;
  padding: 1rem 0.8rem 1.3rem;
  scroll-padding-inline: 1rem;
  scrollbar-width: thin;
}

.uno-hand :deep(.uno-card + .uno-card) { margin-left: -0.75rem; }

@media (min-width: 768px) {
  .uno-hand { justify-content: center; }
  .uno-hand :deep(.uno-card + .uno-card) { margin-left: -1rem; }
}
</style>
