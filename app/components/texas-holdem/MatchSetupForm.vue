<script setup lang="ts">
import { holdemFormatLabels, HOLDEM_RULES } from '#shared/games/texas-holdem/rules'
import type { HoldemCard, HoldemFormat } from '#shared/games/texas-holdem'

const toast = useToast()
const name = shallowRef('Poker night')
const format = shallowRef<HoldemFormat>('fixed-hands')
const submitting = shallowRef(false)
const formats = [
  { value: 'fixed-hands', description: 'Fixed blinds. The biggest stack wins after 12 hands.', icon: 'i-lucide-layers-2' },
  { value: 'tournament', description: 'Blinds rise. Play down to the last stack.', icon: 'i-lucide-trophy' }
] as const
const preview: HoldemCard[] = ['Qs', 'Ah', 'Jc']

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const result = await $fetch<{ matchId: string, inviteUrl: string }>('/api/matches', {
      method: 'POST',
      body: { gameKey: 'texas-holdem.v1', name: name.value, settings: { format: format.value } }
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
  <div class="holdem-setup mx-auto max-w-[1220px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <UButton
      to="/"
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      class="-ml-2 mb-6"
    >
      Back to games
    </UButton>
    <div class="holdem-setup__grid">
      <section class="holdem-setup__feature">
        <div class="holdem-setup__title">
          <h1>Texas<br>Hold’em</h1>
          <p>Deal a private table for <span class="whitespace-nowrap">2–8 players.</span></p>
        </div>
        <div
          class="holdem-setup__art"
          aria-hidden="true"
        >
          <div class="holdem-setup__arc" />
          <TexasHoldemCard
            v-for="card in preview"
            :key="card"
            :value="card"
          />
          <span class="holdem-setup__dealer">D</span>
        </div>
        <dl class="holdem-setup__facts">
          <div><dt>Starting stack</dt><dd>{{ HOLDEM_RULES.startingStack.toLocaleString('en-US') }} chips</dd></div>
          <div><dt>Opening blinds</dt><dd>5 / 10</dd></div>
        </dl>
      </section>
      <form
        class="holdem-setup__form game-panel"
        @submit.prevent="submit"
      >
        <h2 class="font-display text-3xl font-bold tracking-tight">
          Set up your table
        </h2>
        <UFormField
          label="Match name"
          required
          class="mt-6"
        >
          <UInput
            v-model="name"
            required
            minlength="2"
            maxlength="48"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <fieldset class="mt-6">
          <legend class="font-semibold">
            Match format
          </legend>
          <label
            v-for="option in formats"
            :key="option.value"
            class="holdem-setup__option"
          >
            <UIcon
              :name="option.icon"
              class="size-5 shrink-0"
              aria-hidden="true"
            />
            <span>
              <strong class="block">{{ holdemFormatLabels[option.value] }}</strong>
              <span class="block text-sm text-slate-600">{{ option.description }}</span>
            </span>
            <input
              v-model="format"
              type="radio"
              name="holdem-format"
              :value="option.value"
            >
          </label>
        </fieldset>
        <div class="mt-7 flex flex-wrap items-center justify-between gap-3">
          <TexasHoldemRulesModal />
          <UButton
            type="submit"
            size="lg"
            :loading="submitting"
            trailing-icon="i-lucide-arrow-right"
          >
            Create private match
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.holdem-setup__grid {
  display: grid;
  gap: clamp(1rem, 3vw, 2rem);
  grid-template-columns: minmax(0, 1.06fr) minmax(0, 1fr);
  align-items: stretch;
}

.holdem-setup__feature {
  position: relative;
  display: grid;
  isolation: isolate;
  align-content: space-between;
  min-height: 30rem;
  padding: clamp(1.45rem, 3.5vw, 3rem);
  overflow: hidden;
  border-radius: 16px;
  color: #fbf3df;
  background: radial-gradient(ellipse at 79% 44%, #285d50, #163d38 62%, #112e35);
}

.holdem-setup__title { z-index: 1; }
.holdem-setup__title h1 {
  font-family: var(--font-display);
  font-size: clamp(3.9rem, 8vw, 6rem);
  font-weight: 800;
  line-height: 0.86;
  letter-spacing: -0.035em;
}
.holdem-setup__title p { max-width: 23ch; margin-top: 1.2rem; color: #cadfd4; text-wrap: pretty; }

.holdem-setup__art {
  --holdem-card-size: clamp(4rem, 7.5vw, 6.8rem);
  --holdem-card-type: clamp(1rem, 1.65vw, 1.55rem);
  position: absolute;
  right: -8%;
  bottom: 11%;
  width: 53%;
  height: 44%;
}

.holdem-setup__arc {
  position: absolute;
  inset: -8% -18% -18% -33%;
  border: 1px solid #c9b58364;
  border-radius: 50%;
  transform: rotate(-26deg);
}

.holdem-setup__art .playing-card { position: absolute; top: 24%; }
.holdem-setup__art .playing-card:nth-of-type(1) { left: 1%; transform: rotate(-24deg); }
.holdem-setup__art .playing-card:nth-of-type(2) { left: 23%; top: 16%; transform: rotate(-7deg); }
.holdem-setup__art .playing-card:nth-of-type(3) { left: 46%; transform: rotate(12deg); }
.holdem-setup__dealer {
  position: absolute;
  display: grid;
  place-items: center;
  bottom: 5%;
  left: 6%;
  width: 2.55rem;
  aspect-ratio: 1;
  border-radius: 50%;
  color: #162c32;
  background: #eec980;
  box-shadow: 0 4px 8px #071d2d7a, inset 0 0 0 3px #eec980, inset 0 0 0 4px #936d35;
  font-weight: 800;
}

.holdem-setup__facts { z-index: 1; display: flex; flex-wrap: wrap; gap: 1.6rem; }
.holdem-setup__facts dt { color: #c0d8ca; font-size: 0.8rem; }
.holdem-setup__facts dd { font: 600 1rem var(--font-mono); margin-top: 0.2rem; }
.holdem-setup__form { padding: clamp(1.25rem, 3.2vw, 2.5rem); border-radius: 16px; align-self: stretch; }
.holdem-setup__option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
  padding: 0.85rem 0.9rem;
  margin-top: 0.65rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  cursor: pointer;
}
.holdem-setup__option:has(:checked) { border-color: var(--ui-primary); background: color-mix(in srgb, var(--ui-primary) 8%, transparent); }
.holdem-setup__option:has(:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.holdem-setup__option input { accent-color: var(--ui-primary); }

@media (max-width: 780px) {
  .holdem-setup__grid { grid-template-columns: 1fr; }
  .holdem-setup__feature { min-height: 23rem; }
  .holdem-setup__art { bottom: 12%; width: 48%; }
}

@media (max-width: 460px) {
  .holdem-setup__title h1 { font-size: clamp(3rem, 12vw, 3.9rem); }
  .holdem-setup__title p { max-width: 16ch; }
  .holdem-setup__art { bottom: 15%; right: -6%; width: 54%; height: 42%; }
  .holdem-setup__facts { gap: 1rem; }
}
</style>
