<script setup lang="ts">
import type { MatchMemberView } from '../../../shared/types/api'

const props = defineProps<{ members: MatchMemberView[], title?: string }>()
const ranked = computed(() => [...props.members]
  .sort((left, right) => (right.cumulativeScore ?? 0) - (left.cumulativeScore ?? 0) || left.displayName.localeCompare(right.displayName))
  .map((member, index) => ({ ...member, rank: index + 1 })))
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div
      v-if="title"
      class="border-b border-slate-200 px-5 py-4"
    >
      <h2 class="font-display text-xl font-bold">
        {{ title }}
      </h2>
    </div>
    <ol class="divide-y divide-slate-200">
      <li
        v-for="member in ranked"
        :key="member.id"
        class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-4"
      >
        <span
          class="font-mono text-lg font-black"
          :class="member.rank === 1 ? 'text-primary-600' : 'text-slate-400'"
        >{{ String(member.rank).padStart(2, '0') }}</span>
        <div>
          <p class="font-semibold">
            {{ member.displayName }}
          </p><p class="text-xs text-slate-500">
            {{ member.role === 'host' ? 'Host' : 'Player' }}
          </p>
        </div>
        <span class="font-mono text-xl font-black">{{ member.cumulativeScore ?? 0 }} <small class="text-xs font-medium text-slate-400">pts</small></span>
      </li>
    </ol>
  </div>
</template>
