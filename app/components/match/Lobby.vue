<script setup lang="ts">
import type { MatchView } from '../../../shared/types/api'

const props = defineProps<{ match: MatchView, connected: boolean, cancelling: boolean }>()
const emit = defineEmits<{
  command: [command:
    | { type: 'member.ready', ready: boolean }
    | { type: 'member.remove', memberId: string }
    | { type: 'match.start' }]
  cancel: []
}>()
const toast = useToast()
const inviteUrl = ref('')
const generating = ref(false)

const viewer = computed(() => props.match.members.find(member => member.id === props.match.viewerMemberId)!)
const isHost = computed(() => viewer.value?.role === 'host')
const canStart = computed(() => props.match.members.length >= 2 && props.match.members.every(member => member.ready))

onMounted(() => {
  inviteUrl.value = sessionStorage.getItem(`mind-boggling:invite:${props.match.id}`) ?? ''
})

async function generateInvite() {
  generating.value = true
  try {
    const result = await $fetch<{ inviteUrl: string }>(`/api/matches/${props.match.id}/invite`, { method: 'POST' })
    inviteUrl.value = result.inviteUrl
    sessionStorage.setItem(`mind-boggling:invite:${props.match.id}`, result.inviteUrl)
  } finally {
    generating.value = false
  }
}

async function copyInvite() {
  await navigator.clipboard.writeText(inviteUrl.value)
  toast.add({ title: 'Invite copied', description: 'Send it to another approved Mind Boggling player.', color: 'success' })
}

async function revokeInvite() {
  await $fetch(`/api/matches/${props.match.id}/invite`, { method: 'DELETE' })
  inviteUrl.value = ''
  sessionStorage.removeItem(`mind-boggling:invite:${props.match.id}`)
  toast.add({ title: 'Invite revoked', description: 'That link can no longer be used.', color: 'success' })
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_23rem]">
    <section class="game-panel rounded-xl p-6 sm:p-8">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <UBadge
            :color="connected ? 'success' : 'warning'"
            variant="soft"
          >
            {{ connected ? 'Room connected' : 'Reconnecting' }}
          </UBadge>
          <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight">
            {{ match.name }}
          </h1>
          <p class="mt-2 text-slate-600">
            Share the link, let everyone mark ready, then start together.
          </p>
        </div>
        <div class="rounded-lg bg-primary-50 px-4 py-3 text-right">
          <p class="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Players
          </p>
          <p class="font-mono text-2xl font-black">
            {{ match.members.length }}<span class="text-sm text-primary-400">/8</span>
          </p>
        </div>
      </div>

      <div class="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-xl font-bold">
            Invite players
          </h2><UIcon
            name="i-lucide-link"
            class="size-5 text-primary-600"
          />
        </div>
        <template v-if="isHost">
          <div
            v-if="inviteUrl"
            class="mt-4 space-y-2"
          >
            <div class="flex gap-2">
              <UInput
                :model-value="inviteUrl"
                readonly
                class="min-w-0 flex-1"
              />
              <UButton
                icon="i-lucide-copy"
                aria-label="Copy invite link"
                @click="copyInvite"
              />
            </div>
            <div class="flex gap-2">
              <UButton
                variant="soft"
                icon="i-lucide-refresh-cw"
                :loading="generating"
                @click="generateInvite"
              >
                Replace link
              </UButton>
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-link-2-off"
                @click="revokeInvite"
              >
                Revoke
              </UButton>
            </div>
          </div>
          <UButton
            v-else
            class="mt-4"
            variant="soft"
            icon="i-lucide-link"
            :loading="generating"
            @click="generateInvite"
          >
            Generate invite link
          </UButton>
          <p class="mt-2 text-xs text-slate-500">
            Any approved Clerk user can use this link before the match starts.
          </p>
        </template>
        <p
          v-else
          class="mt-3 text-sm text-slate-600"
        >
          The host controls the invitation link.
        </p>
      </div>

      <div class="mt-8 flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
        <div>
          <p class="font-semibold">
            {{ viewer.ready ? 'You’re ready to play.' : 'Ready when you are?' }}
          </p>
          <p class="mt-1 text-sm text-slate-500">
            The host can start when everyone is ready.
          </p>
        </div>
        <div class="flex gap-3">
          <UButton
            :color="viewer.ready ? 'neutral' : 'primary'"
            :variant="viewer.ready ? 'outline' : 'solid'"
            @click="emit('command', { type: 'member.ready', ready: !viewer.ready })"
          >
            {{ viewer.ready ? 'Not ready' : 'Mark ready' }}
          </UButton>
          <UButton
            v-if="isHost"
            trailing-icon="i-lucide-play"
            :disabled="!canStart"
            @click="emit('command', { type: 'match.start' })"
          >
            Start match
          </UButton>
        </div>
      </div>
    </section>

    <aside class="game-panel rounded-xl p-6">
      <h2 class="font-display text-xl font-bold">
        At the table
      </h2>
      <MatchPlayerList
        :members="match.members"
        :viewer-member-id="match.viewerMemberId"
        :can-remove="isHost"
        class="mt-3"
        @remove="emit('command', { type: 'member.remove', memberId: $event })"
      />
      <dl class="mt-5 space-y-2 border-t border-slate-200 pt-5 text-sm">
        <div class="flex justify-between">
          <dt class="text-slate-500">
            Board
          </dt><dd class="font-mono font-bold">
            {{ match.settings.boardSize }} × {{ match.settings.boardSize }}
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">
            Timer
          </dt><dd class="font-mono font-bold">
            {{ match.settings.roundSeconds / 60 }} min
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">
            Minimum
          </dt><dd class="font-mono font-bold">
            {{ match.settings.minWordLength }} letters
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">
            Rounds
          </dt><dd class="font-mono font-bold">
            {{ match.settings.rounds }}
          </dd>
        </div>
      </dl>
      <MatchCancelMatchDialog
        v-if="isHost"
        :match-name="match.name"
        :loading="cancelling"
        class="mt-6 w-full"
        @confirm="emit('cancel')"
      />
    </aside>
  </div>
</template>
