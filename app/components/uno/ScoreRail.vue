<script setup lang="ts">
import type { UnoColor, UnoTargetScore } from '#shared/games/uno'
import type { MatchMemberView } from '../../../shared/types/api'

const props = defineProps<{
  members: MatchMemberView[]
  scores: Record<string, number>
  targetScore: UnoTargetScore
  activeMemberId?: string
  viewerMemberId: string
  activeColor?: UnoColor
}>()

const ranked = computed(() => [...props.members]
  .sort((left, right) => (props.scores[right.id] ?? 0) - (props.scores[left.id] ?? 0) || left.displayName.localeCompare(right.displayName))
  .map((member, index) => ({
    ...member,
    rank: index + 1,
    score: props.scores[member.id] ?? 0
  })))

const leaderProgress = computed(() => {
  const leaderScore = ranked.value[0]?.score ?? 0
  return Math.min(100, leaderScore / props.targetScore * 100)
})
</script>

<template>
  <aside
    class="score-rail"
    :class="`score-rail--${activeColor ?? 'wild'}`"
    aria-label="Score race"
  >
    <header class="score-rail__header">
      <div>
        <h2 class="font-display text-lg font-black text-white">
          Score race
        </h2>
        <p class="score-rail__target">
          First to {{ targetScore.toLocaleString() }}
        </p>
      </div>
      <span
        class="score-rail__flag"
        aria-hidden="true"
      >
        <UIcon
          name="i-lucide-flag"
          class="size-4"
        />
      </span>
    </header>

    <ol class="score-rail__players">
      <li
        v-for="member in ranked"
        :key="member.id"
        class="score-rail__player"
        :class="{
          'score-rail__player--active': member.id === activeMemberId,
          'score-rail__player--viewer': member.id === viewerMemberId
        }"
      >
        <span class="score-rail__rank">{{ member.rank }}</span>
        <span class="min-w-0 flex-1">
          <span class="score-rail__name">
            {{ member.id === viewerMemberId ? 'You' : member.displayName }}
          </span>
          <span class="score-rail__role">
            <span
              class="score-rail__presence"
              :class="member.connected ? 'bg-emerald-400' : 'bg-amber-400'"
            />
            {{ member.id === activeMemberId ? 'Playing' : member.role === 'host' ? 'Host' : 'Ready' }}
          </span>
        </span>
        <strong class="score-rail__score">{{ member.score }}</strong>
      </li>
    </ol>

    <footer class="score-rail__finish">
      <div
        class="score-rail__track"
        aria-hidden="true"
      >
        <span :style="{ '--score-progress': leaderProgress / 100 }" />
      </div>
      <p>
        Action cards score 20 · Wilds score 50
      </p>
    </footer>
  </aside>
</template>

<style scoped>
.score-rail {
  --score-accent: #fff7e6;
  position: relative;
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.9rem;
  background: #11151d;
  color: #fff7e6;
  box-shadow: 0 1.2rem 2.8rem rgb(4 8 16 / 24%);
}

.score-rail::before {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 105% -5%, color-mix(in srgb, var(--score-accent) 20%, transparent), transparent 34%);
  content: '';
  pointer-events: none;
}

.score-rail--red { --score-accent: #ef4b46; }
.score-rail--yellow { --score-accent: #ffc928; }
.score-rail--green { --score-accent: #29c469; }
.score-rail--blue { --score-accent: #378fea; }
.score-rail--wild { --score-accent: #ffc928; }

.score-rail__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 1rem;
}

.score-rail__target,
.score-rail__role,
.score-rail__finish {
  color: rgb(255 247 230 / 62%);
  font-size: 0.7rem;
}

.score-rail__target { margin-top: 0.1rem; font-family: 'IBM Plex Mono', monospace; font-weight: 700; }
.score-rail__flag { display: grid; width: 2.1rem; aspect-ratio: 1; place-items: center; border-radius: 50%; background: var(--score-accent); color: #11151d; }
.score-rail__players { position: relative; min-height: 0; flex: 1; overflow-y: auto; padding: 0 0.55rem; scrollbar-color: rgb(255 255 255 / 24%) transparent; scrollbar-width: thin; }

.score-rail__player {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 3.7rem;
  padding: 0.55rem;
  border-radius: 0.65rem;
}

.score-rail__player--active { background: color-mix(in srgb, var(--score-accent) 14%, transparent); }
.score-rail__player--viewer .score-rail__name { color: var(--score-accent); }
.score-rail__rank { display: grid; width: 1.65rem; aspect-ratio: 1; place-items: center; border: 1px solid rgb(255 247 230 / 18%); border-radius: 50%; color: rgb(255 247 230 / 58%); font-family: 'IBM Plex Mono', monospace; font-size: 0.67rem; font-weight: 800; }
.score-rail__name { display: block; overflow: hidden; color: #fff7e6; font-size: 0.82rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.score-rail__role { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.05rem; }
.score-rail__presence { width: 0.32rem; height: 0.32rem; border-radius: 50%; }
.score-rail__score { color: #fff7e6; font-family: 'IBM Plex Mono', monospace; font-size: 1rem; font-variant-numeric: tabular-nums; }
.score-rail__finish { position: relative; padding: 0.85rem 1rem 1rem; line-height: 1.35; }
.score-rail__track { height: 0.26rem; margin-bottom: 0.6rem; overflow: hidden; border-radius: 999px; background: rgb(255 255 255 / 10%); }
.score-rail__track span { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--score-accent); transform: scaleX(var(--score-progress)); transform-origin: left; transition: transform 320ms cubic-bezier(.16, 1, .3, 1); }

@media (max-width: 1099px) {
  .score-rail { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; }
  .score-rail__header { min-width: 9rem; padding: 0.55rem 0.8rem; }
  .score-rail__header h2 { font-size: 0.82rem; }
  .score-rail__target { font-size: 0.6rem; }
  .score-rail__flag { width: 1.7rem; }
  .score-rail__players { display: flex; overflow-x: auto; overflow-y: hidden; padding: 0.25rem 0.4rem; }
  .score-rail__player { min-width: 8.5rem; min-height: 2.85rem; padding: 0.35rem 0.5rem; }
  .score-rail__role { display: none; }
  .score-rail__rank { width: 1.35rem; }
  .score-rail__score { font-size: 0.82rem; }
  .score-rail__finish { display: none; }
}

@media (max-width: 520px) {
  .score-rail { grid-template-columns: 6.4rem minmax(0, 1fr); border-radius: 0.65rem; }
  .score-rail__header { min-width: 0; padding: 0.45rem 0.6rem; }
  .score-rail__flag { display: none; }
  .score-rail__target { font-size: 0.55rem; }
  .score-rail__player { min-width: 6.8rem; min-height: 2.5rem; gap: 0.4rem; }
  .score-rail__rank { display: none; }
  .score-rail__name { font-size: 0.72rem; }
}

@media (prefers-reduced-motion: reduce) {
  .score-rail__track span { transition: none; }
}
</style>
