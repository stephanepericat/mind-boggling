<script setup lang="ts">
import type { GameManifest } from '../../../shared/games/contract'

const { data, status, error } = await useFetch<{ games: GameManifest[] }>('/api/catalog')
const { data: history } = await useMatchHistory('/api/history')

const futureGames = [
  { name: 'UNO', icon: 'i-lucide-layers-3', description: 'Classic color-matching chaos for the whole table.' }
]
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
    <div class="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <div>
        <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-700">
          <span class="size-1.5 rounded-full bg-primary-600" />
          Friends & family only
        </div>
        <h1 class="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Choose tonight’s game.
        </h1>
        <p class="mt-3 max-w-2xl text-base text-slate-600">
          Create a private table, share the invite, and keep the score in one place.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/games/farkle/new"
          size="lg"
          icon="i-lucide-dices"
        >
          Create Farkle match
        </UButton>
        <UButton
          to="/games/boggle/new"
          size="lg"
          color="neutral"
          variant="outline"
        >
          Create Boggle match
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      title="The game catalog could not be loaded"
      description="Check your Cloudflare bindings and Clerk session."
      class="mb-6"
    />
    <div
      v-if="status === 'pending'"
      class="grid min-h-64 place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-7 animate-spin text-primary-600"
      />
    </div>

    <div
      v-else
      class="grid gap-5 lg:grid-cols-2"
    >
      <article
        v-for="game in data?.games"
        :key="game.key"
        class="game-panel relative overflow-hidden rounded-xl p-7"
      >
        <div
          class="absolute inset-y-0 right-0 hidden w-2/5 bg-primary-600 xl:grid xl:place-items-center"
          aria-hidden="true"
        >
          <div
            v-if="game.key === 'boggle.v1'"
            class="grid grid-cols-4 gap-2 rotate-3"
          >
            <span
              v-for="letter in ['B', 'O', 'G', 'G', 'L', 'E', 'N', 'I', 'G', 'H', 'T', 'S', 'W', 'O', 'R', 'D']"
              :key="letter"
              class="grid size-12 place-items-center rounded-md bg-white font-mono text-lg font-black text-primary-700 shadow-md"
            >{{ letter }}</span>
          </div>
          <div
            v-else
            class="grid grid-cols-3 gap-3 -rotate-3"
          >
            <span
              v-for="face in 6"
              :key="face"
              class="grid size-14 place-items-center rounded-xl bg-white font-mono text-2xl font-black text-primary-700 shadow-lg"
            >{{ face }}</span>
          </div>
        </div>
        <div class="relative max-w-lg lg:pr-16">
          <UBadge
            color="success"
            variant="soft"
          >
            Available now
          </UBadge>
          <h2 class="mt-5 font-display text-4xl font-extrabold">
            {{ game.name }}
          </h2>
          <p class="mt-3 text-slate-600">
            {{ game.description }}
          </p>
          <dl class="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-5 text-sm">
            <div>
              <dt class="text-slate-500">
                Players
              </dt><dd class="mt-1 font-mono font-bold">
                {{ game.minPlayers }}–{{ game.maxPlayers }}
              </dd>
            </div>
            <div>
              <dt class="text-slate-500">
                Style
              </dt><dd class="mt-1 font-semibold">
                {{ game.capabilities.simultaneousPlay ? 'Simultaneous' : 'Turn-based' }}
              </dd>
            </div>
            <div>
              <dt class="text-slate-500">
                Language
              </dt><dd class="mt-1 font-mono font-bold">
                en-US
              </dd>
            </div>
          </dl>
          <UButton
            :to="`/games/${game.slug}/new`"
            size="lg"
            class="mt-7"
            trailing-icon="i-lucide-arrow-right"
          >
            Set up a match
          </UButton>
        </div>
      </article>

      <aside class="rounded-xl bg-slate-950 p-7 text-white lg:col-span-2">
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">
          Coming in v2
        </p>
        <div class="mt-6 space-y-6">
          <div
            v-for="game in futureGames"
            :key="game.name"
            class="flex gap-4"
          >
            <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
              <UIcon
                :name="game.icon"
                class="size-5"
              />
            </div>
            <div>
              <h3 class="font-display text-xl font-bold">
                {{ game.name }}
              </h3><p class="mt-1 text-sm text-slate-400">
                {{ game.description }}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <section class="mt-12">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Your scoreboard
          </p><h2 class="mt-1 font-display text-2xl font-bold">
            Recent matches
          </h2>
        </div>
        <UButton
          to="/history"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
        >
          View all
        </UButton>
      </div>
      <div
        v-if="history?.matches.length"
        class="game-panel divide-y divide-slate-200 overflow-hidden rounded-xl"
      >
        <NuxtLink
          v-for="match in history.matches.slice(0, 3)"
          :key="match.matchId"
          :to="`/matches/${match.matchId}`"
          class="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50"
        >
          <div><p class="font-semibold">{{ match.matchName }}</p><p class="mt-1 text-sm text-slate-500">{{ match.participants.join(', ') }}</p></div>
          <div class="text-right"><p class="font-mono text-lg font-bold">{{ match.score }} pts</p><p class="text-xs text-slate-500">Place {{ match.placement }}</p></div>
        </NuxtLink>
      </div>
      <div
        v-else
        class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
      >
        Completed matches will appear here.
      </div>
    </section>
  </div>
</template>
