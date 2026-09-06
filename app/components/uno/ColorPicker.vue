<script setup lang="ts">
import { UNO_COLORS } from '#shared/games/uno'
import type { UnoColor } from '#shared/games/uno'

const props = withDefaults(defineProps<{ title?: string, cancelable?: boolean }>(), {
  title: 'Choose the next color',
  cancelable: false
})
const emit = defineEmits<{ choose: [color: UnoColor], cancel: [] }>()

const colorStyles: Record<UnoColor, string> = {
  red: '#E53935',
  yellow: '#FFC928',
  green: '#18A957',
  blue: '#1677E8'
}

function cancelOnEscape(event: KeyboardEvent) {
  if (!props.cancelable) return
  event.preventDefault()
  emit('cancel')
}
</script>

<template>
  <section
    class="color-picker"
    aria-label="Choose the active color"
    @keydown.esc="cancelOnEscape"
  >
    <div class="color-picker__heading">
      <h2 class="font-display text-base font-black text-white">
        {{ title }}
      </h2>
      <UButton
        v-if="cancelable"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Cancel color choice"
        @click="emit('cancel')"
      />
    </div>
    <div class="color-picker__choices">
      <button
        v-for="color in UNO_COLORS"
        :key="color"
        type="button"
        class="color-choice"
        :style="{ backgroundColor: colorStyles[color] }"
        :aria-label="`Choose ${color}`"
        @click="emit('choose', color)"
      >
        <span>{{ color[0]?.toUpperCase() }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.color-picker {
  display: grid;
  grid-template-columns: minmax(9rem, auto) minmax(13rem, 1fr);
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.8rem;
  background: #080b10;
  padding: 0.55rem 0.7rem;
  box-shadow: 0 0.65rem 1.6rem rgb(0 0 0 / 28%);
}

.color-picker__heading { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 0.5rem; }
.color-picker__choices { display: grid; grid-template-columns: repeat(4, minmax(2.6rem, 1fr)); gap: 0.42rem; }

.color-choice {
  display: grid;
  min-height: 2.7rem;
  place-items: center;
  border: 2px solid rgb(255 255 255 / 38%);
  border-radius: 0.75rem;
  color: #fff7e6;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: inset 0 -0.45rem 0 rgb(0 0 0 / 14%);
  transition: transform 140ms ease, filter 140ms ease;
}

.color-choice:hover { transform: translateY(-0.16rem); filter: brightness(1.08); }
.color-choice:focus-visible { outline: 3px solid #fff7e6; outline-offset: 3px; }

@media (max-width: 560px) {
  .color-picker { grid-template-columns: 1fr; gap: 0.4rem; }
  .color-picker__heading h2 { font-size: 0.8rem; }
  .color-choice { min-height: 2.35rem; }
}
</style>
