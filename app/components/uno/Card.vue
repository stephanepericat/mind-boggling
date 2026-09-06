<script setup lang="ts">
import { cardLabel } from '#shared/games/uno'
import type { UnoCard } from '#shared/games/uno'

const props = withDefaults(defineProps<{
  card: UnoCard
  playable?: boolean
  selected?: boolean
  disabled?: boolean
  displayOnly?: boolean
  compact?: boolean
}>(), {
  playable: true,
  selected: false,
  disabled: false,
  displayOnly: false,
  compact: false
})
const emit = defineEmits<{ select: [card: UnoCard] }>()

const label = computed(() => cardLabel(props.card))
const symbol = computed(() => {
  if (props.card.kind === 'number') return String(props.card.number)
  if (props.card.kind === 'skip') return '⊘'
  if (props.card.kind === 'reverse') return '↻'
  if (props.card.kind === 'draw-two') return '+2'
  if (props.card.kind === 'wild-draw-four') return '+4'
  return 'W'
})
const cardClasses = computed(() => [
  `uno-card--${props.card.color ?? 'wild'}`,
  props.playable && !props.displayOnly ? 'uno-card--playable' : '',
  props.selected ? 'uno-card--selected' : '',
  props.compact ? 'uno-card--compact' : '',
  !props.playable && !props.displayOnly ? 'uno-card--muted' : ''
])
const accessibleLabel = computed(() => {
  if (props.displayOnly) return label.value
  return `${label.value}${props.playable ? ', playable' : ', not playable; match the active color, number, or symbol'}`
})

function select() {
  if (!props.disabled && !props.displayOnly && props.playable) emit('select', props.card)
}
</script>

<template>
  <button
    type="button"
    class="uno-card"
    :class="cardClasses"
    :disabled="disabled || displayOnly"
    :aria-disabled="!playable || disabled"
    :aria-pressed="selected"
    :aria-label="accessibleLabel"
    :title="accessibleLabel"
    @click="select"
  >
    <span class="uno-card__corner">{{ symbol }}</span>
    <span class="uno-card__oval">
      <span class="uno-card__symbol">{{ symbol }}</span>
    </span>
    <span class="uno-card__corner uno-card__corner--bottom">{{ symbol }}</span>
  </button>
</template>

<style scoped>
.uno-card {
  --uno-face: #fff7e6;
  --uno-ink: #fff7e6;
  position: relative;
  width: var(--uno-card-width, clamp(4.3rem, 8vw, 6.2rem));
  aspect-ratio: 0.68;
  flex: 0 0 auto;
  overflow: hidden;
  border: 0.24rem solid var(--uno-face);
  border-radius: 0.78rem;
  background: #e53935;
  color: var(--uno-ink);
  box-shadow: 0 0.55rem 1.1rem rgb(4 9 18 / 28%), inset 0 0 0 1px rgb(17 21 29 / 18%);
  transform-origin: 50% 110%;
  transition: transform 160ms ease, filter 160ms ease, opacity 160ms ease, box-shadow 160ms ease;
}

.uno-card--red { background: #e53935; }
.uno-card--yellow { background: #ffc928; --uno-ink: #11151d; }
.uno-card--green { background: #18a957; }
.uno-card--blue { background: #1677e8; }
.uno-card--wild { background: conic-gradient(from 38deg, #e53935 0 25%, #ffc928 0 50%, #18a957 0 75%, #1677e8 0); }

.uno-card--playable {
  z-index: 2;
  transform: translateY(-0.38rem);
  box-shadow: 0 0.75rem 1.3rem rgb(4 9 18 / 32%), 0 0 0 2px rgb(255 247 230 / 62%);
}

.uno-card--playable:hover,
.uno-card--playable:focus-visible {
  z-index: 30;
  transform: translateY(-0.9rem) rotate(-1deg);
  box-shadow: 0 1rem 1.6rem rgb(4 9 18 / 36%), 0 0 0 3px rgb(255 255 255 / 72%);
}

.uno-card:focus-visible { outline: 3px solid #ffc928; outline-offset: 3px; }

.uno-card--selected {
  z-index: 25;
  transform: translateY(-1rem);
  box-shadow: 0 1rem 1.6rem rgb(4 9 18 / 36%), 0 0 0 4px #ffc928;
}

.uno-card--muted {
  filter: saturate(0.52) brightness(0.82);
  opacity: 0.64;
}

.uno-card--compact {
  width: 3.4rem;
  border-width: 0.17rem;
  border-radius: 0.55rem;
  box-shadow: 0 0.3rem 0.75rem rgb(4 9 18 / 24%);
}

.uno-card__oval {
  position: absolute;
  inset: 14% 11%;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 247 230 / 94%);
  color: #11151d;
  transform: rotate(-23deg);
}

.uno-card__symbol {
  font-family: 'Funnel Sans', sans-serif;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.08em;
  transform: rotate(23deg);
}

.uno-card__corner {
  position: absolute;
  z-index: 1;
  top: 0.24rem;
  left: 0.32rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 1px rgb(0 0 0 / 20%);
}

.uno-card__corner--bottom {
  inset: auto 0.32rem 0.24rem auto;
  transform: rotate(180deg);
}

.uno-card:focus-visible {
  z-index: 6;
  outline: 3px solid #fff7e6;
  outline-offset: 4px;
}

.uno-card:disabled { cursor: default; }

@media (prefers-reduced-motion: reduce) {
  .uno-card { transition: none; }
}
</style>
