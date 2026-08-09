<template>
  <span class="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-slate-950">
    <span
      class="grid size-8 grid-cols-2 gap-0.5 rounded-md bg-primary-600 p-1 shadow-sm"
      aria-hidden="true"
    >
      <span
        v-for="letter in ['M', 'I', 'N', 'D']"
        :key="letter"
        class="grid place-items-center rounded-[2px] bg-white text-[8px] font-black text-primary-700"
      >
        {{ letter }}
      </span>
    </span>
    Mind Boggling
  </span>
</template>
