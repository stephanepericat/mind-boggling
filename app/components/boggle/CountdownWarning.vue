<script setup lang="ts">
const props = defineProps<{
  remainingSeconds: number
  enabled: boolean
}>()

const isVisible = computed(() => props.enabled && props.remainingSeconds >= 1 && props.remainingSeconds <= 10)

useCountdownWarning(
  () => props.remainingSeconds,
  () => props.enabled
)
</script>

<template>
  <div
    v-if="isVisible"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    class="fixed inset-x-4 top-[5.5rem] z-30 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-red-950 shadow-lg sm:px-5"
    :class="remainingSeconds <= 3 ? 'motion-safe:animate-pulse' : ''"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-full bg-red-600 text-white">
        <UIcon
          name="i-lucide-volume-2"
          class="size-5"
          aria-hidden="true"
        />
      </span>
      <div>
        <p class="font-display text-lg font-extrabold">
          {{ remainingSeconds <= 3 ? 'Last chance!' : 'Round ending soon' }}
        </p>
        <p class="text-sm text-red-800">
          Submit your final words now.
        </p>
      </div>
    </div>
    <p class="shrink-0 font-mono text-4xl font-black tabular-nums">
      {{ remainingSeconds }}<span class="ml-1 text-sm">sec</span>
    </p>
  </div>
</template>
