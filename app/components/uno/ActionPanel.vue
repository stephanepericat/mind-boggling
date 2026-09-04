<script setup lang="ts">
import type { UnoPlayerView } from '#shared/games/uno'
import type { MatchMemberView } from '../../../shared/types/api'

const props = defineProps<{
  view: UnoPlayerView
  members: MatchMemberView[]
  viewerMemberId: string
  unoArmed: boolean
  now: number
}>()
const emit = defineEmits<{
  draw: []
  pass: []
  call: []
  catch: []
  respond: [response: 'accept' | 'challenge']
  toggleUno: []
  resolveDisconnect: [memberId: string]
}>()

const activeName = computed(() => memberName(props.view.activeMemberId))
const vulnerableName = computed(() => memberName(props.view.vulnerableMemberId))
const viewerHandCount = computed(() => props.view.hand.length)
const canArmUno = computed(() => props.view.activeMemberId === props.viewerMemberId && viewerHandCount.value === 2)
const resolveMemberId = computed(() => props.view.pendingWildDrawFour?.affectedMemberId ?? props.view.startingWildChooserMemberId ?? props.view.activeMemberId)
const resolveSeconds = computed(() => props.view.disconnectResolveAt
  ? Math.max(0, Math.ceil((props.view.disconnectResolveAt - props.now) / 1000))
  : 0)

function memberName(memberId?: string): string {
  return props.members.find(member => member.id === memberId)?.displayName ?? 'Player'
}
</script>

<template>
  <div class="action-panel">
    <div class="min-w-0">
      <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
        Turn signal
      </p>
      <p class="mt-1 truncate font-display text-lg font-black text-white">
        {{ view.activeMemberId === viewerMemberId ? 'Your move.' : `${activeName} is up.` }}
      </p>
    </div>

    <div
      v-if="view.pendingWildDrawFour?.canRespond"
      class="action-panel__urgent"
    >
      <div>
        <p class="font-bold text-white">
          Wild Draw Four
        </p>
        <p class="text-xs text-white/60">
          Accept four cards or challenge the play.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="view.canCallUno"
          color="warning"
          @click="emit('call')"
        >
          Call UNO now
        </UButton>
        <UButton
          v-if="view.canCatchUno"
          color="warning"
          variant="soft"
          icon="i-lucide-zap"
          @click="emit('catch')"
        >
          Catch {{ vulnerableName }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('respond', 'challenge')"
        >
          Challenge
        </UButton>
        <UButton
          color="error"
          @click="emit('respond', 'accept')"
        >
          Accept 4
        </UButton>
      </div>
    </div>

    <div
      v-else
      class="flex flex-wrap items-center justify-end gap-2"
    >
      <UButton
        v-if="view.canDraw"
        color="neutral"
        variant="outline"
        icon="i-lucide-layers-3"
        @click="emit('draw')"
      >
        Draw one
      </UButton>
      <UButton
        v-if="view.canPass"
        color="neutral"
        variant="outline"
        @click="emit('pass')"
      >
        Pass
      </UButton>
      <UButton
        v-if="canArmUno"
        :color="unoArmed ? 'warning' : 'neutral'"
        :variant="unoArmed ? 'solid' : 'outline'"
        @click="emit('toggleUno')"
      >
        {{ unoArmed ? 'UNO armed' : 'Call UNO' }}
      </UButton>
      <UButton
        v-if="view.canCallUno"
        color="warning"
        @click="emit('call')"
      >
        Call UNO now
      </UButton>
      <UButton
        v-if="view.canCatchUno"
        color="error"
        icon="i-lucide-zap"
        @click="emit('catch')"
      >
        Catch {{ vulnerableName }}
      </UButton>
    </div>

    <div
      v-if="view.canResolveDisconnectedPlayer && resolveMemberId"
      class="action-panel__disconnect"
    >
      <span>{{ memberName(resolveMemberId) }} disconnected.</span>
      <UButton
        size="xs"
        color="warning"
        variant="soft"
        :disabled="resolveSeconds > 0"
        @click="emit('resolveDisconnect', resolveMemberId)"
      >
        {{ resolveSeconds > 0 ? `Resolve in ${resolveSeconds}s` : 'Resolve turn' }}
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.action-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 1rem;
  background: rgb(7 10 15 / 76%);
  padding: 0.85rem 1rem;
  backdrop-filter: blur(16px);
}

.action-panel__urgent,
.action-panel__disconnect {
  display: flex;
  flex: 1 1 28rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.action-panel__disconnect {
  flex-basis: 100%;
  border-top: 1px solid rgb(255 255 255 / 10%);
  padding-top: 0.7rem;
  color: #ffc928;
  font-size: 0.78rem;
  font-weight: 700;
}
</style>
