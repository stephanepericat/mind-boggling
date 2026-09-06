<script setup lang="ts">
import { sortUnoCards } from '#shared/games/uno'
import type { UnoCard } from '#shared/games/uno'

const props = defineProps<{
  cards: UnoCard[]
  playableCardIds: string[]
  drawnCardId?: string
}>()
const emit = defineEmits<{ play: [card: UnoCard] }>()
const hand = useTemplateRef<HTMLDivElement>('hand')
const playable = computed(() => new Set(props.playableCardIds))
const availableWidth = shallowRef(720)
const viewportHeight = shallowRef(800)
const sortedCards = computed(() => sortUnoCards(props.cards))
let resizeObserver: ResizeObserver | null = null
let resizeFrame = 0

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight
}

const handStyle = computed(() => {
  const count = sortedCards.value.length
  const widthByContainer = availableWidth.value < 430 ? 58 : availableWidth.value < 760 ? 68 : 84
  const widthByHeight = viewportHeight.value < 680 ? 58 : viewportHeight.value < 780 ? 70 : 84
  const width = Math.min(widthByContainer, widthByHeight)
  const usableWidth = Math.max(width, availableWidth.value - 24)
  const step = count > 1
    ? Math.max(14, Math.min(width + 4, (usableWidth - width) / (count - 1)))
    : width
  const railWidth = count === 0 ? 0 : width + step * (count - 1)

  return {
    '--uno-card-width': `${width}px`,
    '--uno-card-overlap': `${Math.max(0, width - step)}px`,
    '--uno-hand-rail-width': `${railWidth}px`
  }
})

function moveFocus(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const buttons = [...(hand.value?.querySelectorAll<HTMLButtonElement>('.uno-card') ?? [])]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0 || buttons.length === 0) return
  event.preventDefault()
  const offset = event.key === 'ArrowRight' ? 1 : -1
  const nextButton = buttons[(current + offset + buttons.length) % buttons.length]
  nextButton?.focus({ preventScroll: true })
  nextButton?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'nearest'
  })
}

onMounted(() => {
  if (!hand.value) return
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      availableWidth.value = entry.contentRect.width
    })
  })
  resizeObserver.observe(hand.value)
})

onScopeDispose(() => {
  if (!import.meta.client) return
  cancelAnimationFrame(resizeFrame)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateViewportHeight)
})
</script>

<template>
  <div
    ref="hand"
    class="uno-hand"
    :style="handStyle"
    role="group"
    aria-label="Your hand, sorted by color and card value. Use left and right arrows to move between cards."
    @keydown="moveFocus"
  >
    <div class="uno-hand__rail">
      <UnoCard
        v-for="card in sortedCards"
        :key="card.id"
        :card="card"
        :playable="playable.has(card.id)"
        :selected="card.id === drawnCardId"
        @select="emit('play', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.uno-hand {
  min-height: calc(var(--uno-card-width) / 0.68 + 1.2rem);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.8rem 0.75rem 0.3rem;
  scroll-padding-inline: 0.75rem;
  scrollbar-color: rgb(255 247 230 / 30%) transparent;
  scrollbar-width: thin;
}

.uno-hand__rail {
  display: flex;
  width: var(--uno-hand-rail-width);
  min-width: var(--uno-hand-rail-width);
  align-items: flex-end;
  margin-inline: auto;
  padding-top: 0.7rem;
}

.uno-hand__rail :deep(.uno-card + .uno-card) { margin-left: calc(var(--uno-card-overlap) * -1); }
.uno-hand::-webkit-scrollbar { height: 0.35rem; }
.uno-hand::-webkit-scrollbar-thumb { border-radius: 999px; background: rgb(255 247 230 / 30%); }
</style>
