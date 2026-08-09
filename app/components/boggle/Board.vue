<script setup lang="ts">
import type { BoggleBoard } from '../../../shared/games/boggle'

const props = defineProps<{ board: BoggleBoard, selectedPath?: number[], viewportFit?: boolean }>()
const emit = defineEmits<{ select: [tileId: number] }>()

const style = computed(() => ({ gridTemplateColumns: `repeat(${props.board.size}, minmax(0, 1fr))` }))
</script>

<template>
  <div
    class="boggle-board mx-auto grid w-full rounded-2xl bg-primary-700 shadow-xl"
    :class="viewportFit ? 'boggle-board--viewport' : 'max-w-[38rem] gap-2 p-3 sm:gap-3 sm:p-5'"
    :style="style"
    role="grid"
    :aria-label="`${board.size} by ${board.size} Boggle board`"
  >
    <button
      v-for="tile in board.tiles"
      :key="tile.id"
      type="button"
      role="gridcell"
      class="boggle-tile grid aspect-square min-w-0 place-items-center rounded-lg border bg-white font-mono font-black uppercase text-slate-950 shadow-sm transition active:translate-y-px active:shadow-none"
      :class="[
        `boggle-tile--${board.size}`,
        selectedPath?.includes(tile.id) ? 'border-amber-400 bg-amber-100 text-primary-800' : 'border-slate-300 hover:bg-primary-50'
      ]"
      :aria-label="`Tile ${tile.row + 1}, ${tile.column + 1}: ${tile.letters}`"
      :aria-pressed="selectedPath?.includes(tile.id)"
      @click="emit('select', tile.id)"
    >
      {{ tile.letters }}
    </button>
  </div>
</template>

<style scoped>
.boggle-board {
  container-type: inline-size;
}

.boggle-board--viewport {
  width: min(100%, 38rem, max(20rem, calc(100dvh - 18rem)));
  gap: clamp(0.4rem, 1dvh, 0.75rem);
  padding: clamp(0.65rem, 1.5dvh, 1.25rem);
}

.boggle-tile--4 {
  font-size: clamp(1.875rem, 11cqi, 3rem);
}

.boggle-tile--5 {
  font-size: clamp(1.5rem, 8cqi, 2.25rem);
}

.boggle-tile--6 {
  font-size: clamp(1.25rem, 6cqi, 1.875rem);
}
</style>
