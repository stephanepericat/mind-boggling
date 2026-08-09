<script setup lang="ts">
import type { BoggleBoard } from '../../../shared/games/boggle'

const props = defineProps<{ board: BoggleBoard, selectedPath?: number[] }>()
const emit = defineEmits<{ select: [tileId: number] }>()

const style = computed(() => ({ gridTemplateColumns: `repeat(${props.board.size}, minmax(0, 1fr))` }))
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-[38rem] gap-2 rounded-2xl bg-primary-700 p-3 shadow-xl sm:gap-3 sm:p-5"
    :style="style"
    role="grid"
    :aria-label="`${board.size} by ${board.size} Boggle board`"
  >
    <button
      v-for="tile in board.tiles"
      :key="tile.id"
      type="button"
      role="gridcell"
      class="grid aspect-square min-w-0 place-items-center rounded-lg border-b-4 bg-white font-mono font-black uppercase text-slate-950 shadow-sm transition active:translate-y-0.5 active:border-b-2"
      :class="[
        board.size === 4 ? 'text-3xl sm:text-5xl' : board.size === 5 ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-3xl',
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
