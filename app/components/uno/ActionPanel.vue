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
const isViewerTurn = computed(() => props.view.activeMemberId === props.viewerMemberId)
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
  <div
    class="action-panel"
    :class="{ 'action-panel--yours': isViewerTurn }"
  >
    <div class="action-panel__signal">
      <span class="action-panel__signal-icon">
        <UIcon
          :name="isViewerTurn ? 'i-lucide-mouse-pointer-click' : 'i-lucide-hourglass'"
          class="size-4"
          aria-hidden="true"
        />
      </span>
      <p class="min-w-0 truncate">
        <strong>{{ isViewerTurn ? 'Your turn' : `${activeName}'s turn` }}</strong>
        <span>{{ isViewerTurn ? 'Play a raised card or draw one.' : 'Watch the center pile.' }}</span>
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
        <p class="action-panel__hint">
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
      class="action-panel__controls"
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
        :aria-pressed="unoArmed"
        icon="i-lucide-megaphone"
        @click="emit('toggleUno')"
      >
        {{ unoArmed ? 'UNO armed' : 'Call UNO' }}
      </UButton>
      <UButton
        v-if="view.canCallUno"
        color="warning"
        icon="i-lucide-megaphone"
        @click="emit('call')"
      >
        Call UNO now
      </UButton>
      <UButton
        v-if="view.canCatchUno"
        color="error"
        icon="i-lucide-zap"
        :title="`Catch ${vulnerableName} before the next player plays or draws`"
        @click="emit('catch')"
      >
        Catch {{ vulnerableName }}
      </UButton>
    </div>

    <p
      v-if="view.canCatchUno"
      class="action-panel__catch-copy"
    >
      {{ vulnerableName }} reached one card without calling UNO. Catch them before the next player plays or draws.
    </p>
    <p
      v-else-if="view.canCallUno"
      class="action-panel__catch-copy action-panel__catch-copy--safe"
    >
      You forgot to call UNO. Call it now before another player catches you.
    </p>

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
  --signal: #fff7e6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  border-radius: 0.8rem;
  background: #080b10;
  padding: 0.65rem 0.8rem;
  box-shadow: 0 0.65rem 1.6rem rgb(0 0 0 / 28%);
}

.action-panel--yours { --signal: #ffc928; background: color-mix(in srgb, #ffc928 9%, #080b10); }
.action-panel__signal { display: flex; min-width: 12rem; align-items: center; gap: 0.65rem; color: #fff7e6; }
.action-panel__signal-icon { display: grid; width: 2rem; aspect-ratio: 1; flex: 0 0 auto; place-items: center; border-radius: 50%; background: var(--signal); color: #11151d; }
.action-panel__signal strong { display: block; font-family: 'Funnel Sans', sans-serif; font-size: 0.95rem; font-weight: 900; }
.action-panel__signal span { display: block; color: rgb(255 247 230 / 62%); font-size: 0.68rem; }
.action-panel__controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.45rem; }
.action-panel__hint { color: rgb(255 247 230 / 66%); font-size: 0.75rem; }

.action-panel__urgent,
.action-panel__disconnect {
  display: flex;
  flex: 1 1 28rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.action-panel__catch-copy {
  flex-basis: 100%;
  color: #ffaaa6;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
}

.action-panel__catch-copy--safe { color: #ffe38c; }

@media (max-width: 640px) {
  .action-panel { gap: 0.45rem; padding: 0.5rem 0.6rem; }
  .action-panel__signal { min-width: 7.5rem; flex: 1 1 7.5rem; }
  .action-panel__signal span { display: none; }
  .action-panel__controls { flex-wrap: nowrap; }
  .action-panel__controls :deep(.u-button) { padding-inline: 0.55rem; }
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
