<script setup lang="ts">
const props = defineProps<{ matchId: string }>()
const toast = useToast()
const { state, connected, loading, error, serverOffset, send, command } = useMatchRealtime(() => props.matchId)
const cancelling = shallowRef(false)

watch(error, (message) => {
  if (message) toast.add({ title: 'Match update', description: message, color: 'warning' })
})

async function sendSimple(value:
  | { type: 'member.ready', ready: boolean }
  | { type: 'member.remove', memberId: string }
  | { type: 'match.start' }
) {
  await send(command(value))
}

async function submitWord(word: string, path?: number[]) {
  await send(command({ type: 'boggle.word.submit', word, path }))
}

async function continueRound() {
  await send(command({ type: 'boggle.round.continue' }))
}

async function endMatch() {
  await send(command({ type: 'match.end' }))
}

async function cancelMatch() {
  cancelling.value = true
  try {
    await $fetch(`/api/matches/${props.matchId}/command`, {
      method: 'POST',
      body: command({ type: 'match.cancel' })
    })
    sessionStorage.removeItem(`mind-boggling:invite:${props.matchId}`)
    toast.add({ title: 'Match cancelled', description: 'The table has been closed.', color: 'success' })
    await navigateTo('/')
  } catch (caught) {
    toast.add({
      title: 'Match not cancelled',
      description: caught instanceof Error ? caught.message : 'Try again.',
      color: 'error'
    })
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
    <div
      v-if="loading"
      class="grid min-h-[65vh] place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary-600"
      />
    </div>
    <UAlert
      v-else-if="!state"
      color="error"
      title="This match could not be opened"
      :description="error ?? 'The room is unavailable.'"
    />
    <template v-else>
      <div class="mb-7 overflow-x-auto pb-2">
        <MatchMatchTrack
          :status="state.status"
          :current-round="state.currentRound"
          :rounds="state.settings.rounds"
        />
      </div>
      <MatchLobby
        v-if="state.status === 'lobby'"
        :match="state"
        :connected="connected"
        :cancelling="cancelling"
        @command="sendSimple"
        @cancel="cancelMatch"
      />
      <BoggleActiveRound
        v-else-if="state.status === 'active'"
        :match="state"
        :server-offset="serverOffset"
        :connected="connected"
        @submit="submitWord"
        @end="endMatch"
      />
      <BoggleRoundResults
        v-else-if="state.status === 'round_results'"
        :match="state"
        @continue="continueRound"
      />
      <MatchFinalResults
        v-else-if="state.status === 'finished'"
        :match="state"
      />
      <UAlert
        v-else-if="state.status === 'cancelled'"
        color="warning"
        icon="i-lucide-circle-x"
        title="This match was cancelled"
        description="The host closed the table before the match started."
        :actions="[{ label: 'Back to games', to: '/', color: 'neutral', variant: 'outline' }]"
      />
      <UAlert
        v-else
        color="warning"
        title="This match is no longer active"
      />
    </template>
  </div>
</template>
