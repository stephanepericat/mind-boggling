<script setup lang="ts">
import type { DiceAppearance } from '../../utils/diceAppearance'

const props = defineProps<{
  playerName: string
  points: number
  appearance: DiceAppearance
}>()

const format = new Intl.NumberFormat('en-US')
</script>

<template>
  <div
    class="absolute inset-0 z-30 grid place-items-center bg-slate-950/92 p-6 text-white backdrop-blur-sm"
    role="status"
    aria-live="assertive"
  >
    <div class="w-full max-w-xl text-center">
      <div class="hot-flame mx-auto grid size-14 place-items-center rounded-full bg-orange-500 text-white shadow-[0_0_40px_rgb(249_115_22/0.55)]">
        <UIcon
          name="i-lucide-flame"
          class="size-8"
        />
      </div>
      <p class="mt-4 font-mono text-xs font-black uppercase tracking-[0.24em] text-orange-300">
        All six scored
      </p>
      <h2 class="hot-title mt-2 font-display text-5xl font-black tracking-[-0.05em] sm:text-7xl">
        Hot dice!
      </h2>
      <p class="mt-3 text-lg font-semibold text-slate-200">
        {{ playerName }} keeps {{ format.format(points) }} unbanked points and rolls all six again.
      </p>
      <div
        class="mx-auto mt-6 grid max-w-sm grid-cols-6 gap-2"
        aria-hidden="true"
      >
        <span
          v-for="face in 6"
          :key="face"
          class="hot-die grid aspect-square place-items-center rounded-lg shadow-lg ring-1 ring-white/20"
          :style="{ backgroundColor: props.appearance.bodyColor, color: props.appearance.pipColor, animationDelay: `${face * 45}ms` }"
        ><DicePips :face="face" /></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes hot-pop {
  0% { opacity: 0; transform: translateY(1rem) scale(0.72) rotate(-5deg); }
  65% { opacity: 1; transform: translateY(-0.15rem) scale(1.06) rotate(1deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
}

@keyframes hot-die {
  0% { opacity: 0; transform: translateY(-1.5rem) rotate(-18deg); }
  70% { opacity: 1; transform: translateY(0.2rem) rotate(4deg); }
  100% { opacity: 1; transform: translateY(0) rotate(0); }
}

.hot-flame,
.hot-title { animation: hot-pop 560ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.hot-die { animation: hot-die 620ms cubic-bezier(0.16, 1, 0.3, 1) both; }

@media (prefers-reduced-motion: reduce) {
  .hot-flame,
  .hot-title,
  .hot-die { animation: none; }
}
</style>
