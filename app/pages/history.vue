<script setup lang="ts">
import AllTimeBest from '~/components/history/AllTimeBest.vue'
import HistoryList from '~/components/history/HistoryList.vue'

type HistoryTab = 'match-history' | 'all-time-best'

const activeTab = shallowRef<HistoryTab>('match-history')
const tabs = [
  { label: 'Match history', value: 'match-history', icon: 'i-lucide-history' },
  { label: 'All-time best', value: 'all-time-best', icon: 'i-lucide-trophy' }
] satisfies Array<{ label: string, value: HistoryTab, icon: string }>

function handleTabKey(event: KeyboardEvent, index: number) {
  let targetIndex: number | null = null
  if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length
  if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length
  if (event.key === 'Home') targetIndex = 0
  if (event.key === 'End') targetIndex = tabs.length - 1
  if (targetIndex === null) return

  event.preventDefault()
  const targetTab = tabs[targetIndex]!
  activeTab.value = targetTab.value
  nextTick(() => document.getElementById(`${targetTab.value}-tab`)?.focus())
}
</script>

<template>
  <PlatformAuthGate>
    <div class="mx-auto max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
          Participant-only
        </p>
        <h1 class="mt-2 font-display text-4xl font-extrabold tracking-tight">
          Scores & history
        </h1>
        <p class="mt-2 text-slate-600">
          Review your matches or see the best scores of all time.
        </p>
      </div>

      <div
        class="mt-8 flex w-fit gap-1 rounded-xl bg-slate-100 p-1"
        role="tablist"
        aria-label="Scores and history"
      >
        <UButton
          v-for="tab in tabs"
          :id="`${tab.value}-tab`"
          :key="tab.value"
          role="tab"
          :tabindex="activeTab === tab.value ? 0 : -1"
          :aria-selected="activeTab === tab.value"
          :aria-controls="`${tab.value}-panel`"
          :color="activeTab === tab.value ? 'primary' : 'neutral'"
          :variant="activeTab === tab.value ? 'solid' : 'ghost'"
          :icon="tab.icon"
          @click="activeTab = tab.value"
          @keydown="handleTabKey($event, tabs.indexOf(tab))"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <section
        v-if="activeTab === 'match-history'"
        id="match-history-panel"
        role="tabpanel"
        aria-labelledby="match-history-tab"
        class="mt-8"
      >
        <HistoryList />
      </section>
      <section
        v-else
        id="all-time-best-panel"
        role="tabpanel"
        aria-labelledby="all-time-best-tab"
        class="mt-8"
      >
        <AllTimeBest />
      </section>
    </div>
  </PlatformAuthGate>
</template>
