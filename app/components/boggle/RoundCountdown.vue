<script setup lang="ts">
defineProps<{
  round: number
  rounds: number
  seconds: number
}>()
</script>

<template>
  <section
    class="grid min-h-[60vh] place-items-center"
    aria-labelledby="round-countdown-title"
  >
    <div class="text-center">
      <p class="text-sm font-bold uppercase tracking-[0.18em] text-primary-600">
        Round {{ round }} of {{ rounds }}
      </p>
      <h1
        id="round-countdown-title"
        class="mt-3 font-display text-3xl font-black text-slate-950 sm:text-4xl"
      >
        Get ready
      </h1>
      <p
        class="mt-5 font-mono text-8xl font-black tabular-nums text-primary-600 sm:text-9xl"
        role="timer"
        aria-live="assertive"
        aria-atomic="true"
      >
        {{ seconds }}
      </p>
      <p class="mt-5 text-sm text-slate-500">
        The board will appear when the round begins.
      </p>
    </div>
  </section>
</template>
