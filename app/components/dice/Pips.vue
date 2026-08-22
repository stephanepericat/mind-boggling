<script setup lang="ts">
const props = defineProps<{ face: number }>()

const pipCells: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
}
const cells = computed(() => pipCells[props.face] ?? [])

function cellStyle(cell: number) {
  const row = Math.ceil(cell / 3)
  const column = (cell - 1) % 3 + 1
  return { gridArea: `${row} / ${column}` }
}
</script>

<template>
  <span
    class="grid size-full grid-cols-3 grid-rows-3 place-items-center p-[16%]"
    aria-hidden="true"
  >
    <span
      v-for="cell in cells"
      :key="cell"
      class="aspect-square w-[52%] rounded-full bg-current shadow-[inset_0_1px_1px_rgb(255_255_255/0.24)]"
      :style="cellStyle(cell)"
    />
  </span>
</template>
