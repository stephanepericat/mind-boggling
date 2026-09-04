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
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
          Wild card
        </p>
        <h2 class="mt-1 font-display text-xl font-black text-white">
          {{ title }}
        </h2>
      </div>
      <UButton
        v-if="cancelable"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Cancel color choice"
        @click="emit('cancel')"
      />
    </div>
    <div class="mt-4 grid grid-cols-4 gap-2">
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
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 1rem;
  background: rgb(7 10 15 / 88%);
  padding: 1rem;
  box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 34%);
  backdrop-filter: blur(16px);
}

.color-choice {
  display: grid;
  min-height: 3.3rem;
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
</style>
