<script setup lang="ts">
import type { HoldemCard } from '#shared/games/texas-holdem'

const props = defineProps<{ value?: HoldemCard, empty?: boolean, featured?: boolean }>()
const suits = {
  s: { glyph: '♠', name: 'spades' },
  c: { glyph: '♣', name: 'clubs' },
  h: { glyph: '♥', name: 'hearts' },
  d: { glyph: '♦', name: 'diamonds' }
} as const
const suit = computed(() => props.value ? suits[props.value[1] as keyof typeof suits] : undefined)
const rank = computed(() => props.value?.[0] === 'T' ? '10' : props.value?.[0])
const red = computed(() => props.value?.endsWith('h') || props.value?.endsWith('d'))
</script>

<template>
  <span
    class="playing-card"
    :class="{ 'playing-card--empty': empty, 'playing-card--red': red, 'playing-card--featured': featured }"
    :role="empty ? undefined : 'img'"
    :aria-hidden="empty || undefined"
    :aria-label="value ? rank + ' of ' + suit?.name : undefined"
  >
    <template v-if="value">
      <span
        class="playing-card__corner"
        aria-hidden="true"
      >{{ rank }}<span>{{ suit?.glyph }}</span></span>
      <span
        class="playing-card__suit"
        aria-hidden="true"
      >{{ suit?.glyph }}</span>
    </template>
  </span>
</template>

<style scoped>
.playing-card {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: var(--holdem-card-size, 3.75rem);
  aspect-ratio: 5 / 7;
  border-radius: 0.42em;
  color: #18253b;
  background: #fbf3df;
  box-shadow: 0 3px 7px #06141580;
  font-size: var(--holdem-card-type, 1rem);
  font-variant-numeric: tabular-nums;
}

.playing-card--red { color: #a6293a; }
.playing-card--featured { outline: 2px solid #f4c574; outline-offset: 2px; }
.playing-card--empty {
  background: #0a24261f;
  outline: 1px dashed #a4c4ae85;
  outline-offset: -1px;
  box-shadow: none;
}

.playing-card__corner {
  position: absolute;
  top: 0.45em;
  left: 0.42em;
  display: grid;
  justify-items: center;
  font-weight: 800;
  line-height: 0.9;
}
.playing-card__corner span { font-size: 0.68em; margin-top: 0.15em; }
.playing-card__suit { font-family: Georgia, serif; font-size: 2.3em; line-height: 1; }
</style>
