<script setup lang="ts">
import type { MatchMemberView } from '../../../shared/types/api'

defineProps<{ members: MatchMemberView[], viewerMemberId: string, active?: boolean, canRemove?: boolean }>()
const emit = defineEmits<{ remove: [memberId: string] }>()
</script>

<template>
  <ul class="divide-y divide-slate-200">
    <li
      v-for="member in members"
      :key="member.id"
      class="flex items-center gap-3 py-3"
    >
      <div class="relative">
        <UAvatar
          :text="member.displayName.slice(0, 2).toUpperCase()"
          size="md"
          class="bg-primary-50 text-primary-700"
        />
        <span
          class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
          :class="member.connected ? 'bg-emerald-500' : 'bg-slate-300'"
          :aria-label="member.connected ? 'Connected' : 'Offline'"
        />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">
          {{ member.displayName }} <span
            v-if="member.id === viewerMemberId"
            class="font-normal text-slate-400"
          >(you)</span>
        </p>
        <p class="mt-0.5 text-xs text-slate-500">
          {{ member.role === 'host' ? 'Host' : active ? `${member.wordCount} words` : member.ready ? 'Ready' : 'Not ready' }}
        </p>
      </div>
      <UBadge
        v-if="!active"
        :color="member.ready ? 'success' : 'neutral'"
        variant="soft"
        size="sm"
      >
        {{ member.ready ? 'Ready' : 'Waiting' }}
      </UBadge>
      <UButton
        v-if="canRemove && member.role !== 'host'"
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-user-minus"
        :aria-label="`Remove ${member.displayName} from the match`"
        @click="emit('remove', member.id)"
      />
      <span
        v-else
        class="font-mono text-sm font-bold"
      >{{ member.wordCount }}</span>
    </li>
  </ul>
</template>
