<script setup lang="ts">
import type { UnoSettings, UnoTargetScore } from '#shared/games/uno'

const toast = useToast()
const submitting = shallowRef(false)
const matchName = shallowRef('Friday UNO night')
const settings = reactive<UnoSettings>({ rulesVersion: 'classic-108.v1', targetScore: 500, locale: 'en-US' })
const scoreOptions: Array<{ value: UnoTargetScore, label: string, description: string }> = [
  { value: 250, label: '250', description: 'Quick · a sharp, shorter match.' },
  { value: 500, label: '500', description: 'Classic · the official finish.' },
  { value: 1000, label: '1,000', description: 'Marathon · settle in for chaos.' }
]

async function submit() {
  submitting.value = true
  try {
    const result = await $fetch<{ matchId: string, inviteUrl: string }>('/api/matches', {
      method: 'POST',
      body: { gameKey: 'uno.v1', name: matchName.value, settings }
    })
    sessionStorage.setItem(`mind-boggling:invite:${result.matchId}`, result.inviteUrl)
    await navigateTo(`/matches/${result.matchId}`)
  } catch (error) {
    toast.add({ title: 'Match not created', description: error instanceof Error ? error.message : 'Try again.', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1120px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
    <UButton
      to="/"
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      class="-ml-3 mb-5"
    >
      Back to games
    </UButton>
    <div class="mb-8">
      <UBadge
        color="error"
        variant="soft"
      >
        UNO · classic 108
      </UBadge>
      <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight">
        Pick the finish line.
      </h1>
      <p class="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
        The deck, action cards, challenges, and scoring stay classic. You decide how long the rivalry runs.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form
        class="game-panel rounded-xl p-6 sm:p-8"
        @submit.prevent="submit"
      >
        <UFormField
          label="Match name"
          required
        >
          <UInput
            v-model="matchName"
            maxlength="48"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <fieldset class="mt-7 border-t border-slate-200 pt-5 dark:border-slate-700">
          <legend class="font-display text-xl font-bold">
            Winning score
          </legend>
          <p class="mt-1 text-sm text-slate-500">
            The round winner collects the value of every card left in opponents’ hands.
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              v-for="option in scoreOptions"
              :key="option.value"
              type="button"
              :aria-pressed="settings.targetScore === option.value"
              class="rounded-xl border p-4 text-left transition"
              :class="settings.targetScore === option.value ? 'border-2 border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-slate-200 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900'"
              @click="settings.targetScore = option.value"
            >
              <span class="block font-mono text-2xl font-black">{{ option.label }}</span>
              <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">{{ option.description }}</span>
            </button>
          </div>
        </fieldset>

        <div class="mt-7 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center dark:border-slate-700">
          <p class="text-xs text-slate-500">
            <UIcon
              name="i-lucide-shield-check"
              class="mr-1 inline size-4"
            />Deck order and rules stay server-controlled.
          </p>
          <UButton
            type="submit"
            size="lg"
            trailing-icon="i-lucide-arrow-right"
            :loading="submitting"
          >
            Create private match
          </UButton>
        </div>
      </form>

      <aside class="uno-preview">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
              At this table
            </p><p class="mt-1 font-display text-xl font-black">
              Classic pressure.
            </p>
          </div>
          <span class="uno-preview__mark">W</span>
        </div>
        <div
          class="uno-preview__cards"
          aria-hidden="true"
        >
          <span class="uno-preview__card uno-preview__card--red">7</span>
          <span class="uno-preview__card uno-preview__card--yellow">↻</span>
          <span class="uno-preview__card uno-preview__card--green">+2</span>
          <span class="uno-preview__card uno-preview__card--blue">3</span>
        </div>
        <dl class="mt-8 space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-white/50">
              Players
            </dt><dd class="font-mono font-bold">
              2–8
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-white/50">
              Starting hand
            </dt><dd class="font-mono font-bold">
              7 cards
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-white/50">
              Deck
            </dt><dd class="font-mono font-bold">
              108 cards
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-white/50">
              Stacking
            </dt><dd class="font-mono font-bold">
              Off
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.uno-preview { overflow: hidden; border-radius: 1rem; background: #11151d; padding: 1.5rem; color: white; box-shadow: 0 1rem 3rem rgb(7 10 15 / 18%); }
.uno-preview__mark { display: grid; width: 2.5rem; aspect-ratio: 1; place-items: center; border-radius: 50%; background: conic-gradient(#e53935, #ffc928, #18a957, #1677e8, #e53935); font-family: 'Funnel Sans', sans-serif; font-weight: 900; }
.uno-preview__cards { position: relative; height: 10rem; margin-top: 2rem; }
.uno-preview__card { position: absolute; left: 50%; top: 50%; display: grid; width: 5.4rem; aspect-ratio: .68; place-items: center; border: .3rem solid #fff7e6; border-radius: .75rem; color: white; font-family: 'Funnel Sans', sans-serif; font-size: 1.7rem; font-weight: 900; box-shadow: 0 .8rem 1.4rem rgb(0 0 0 / 35%); }
.uno-preview__card--red { background: #e53935; transform: translate(-128%, -45%) rotate(-18deg); }
.uno-preview__card--yellow { background: #ffc928; color: #11151d; transform: translate(-77%, -53%) rotate(-6deg); }
.uno-preview__card--green { background: #18a957; transform: translate(-27%, -52%) rotate(7deg); }
.uno-preview__card--blue { background: #1677e8; transform: translate(26%, -44%) rotate(18deg); }
</style>
