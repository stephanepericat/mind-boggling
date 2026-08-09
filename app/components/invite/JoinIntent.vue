<script setup lang="ts">
interface InviteView {
  matchName: string
  gameName: string
  available: boolean
}

const route = useRoute()
const toast = useToast()
const joining = ref(false)
const { data, status, error } = await useFetch<{ invite: InviteView | null }>('/api/invites/intent')

async function join() {
  joining.value = true
  try {
    const result = await $fetch<{ matchId: string }>('/api/invites/intent', { method: 'POST' })
    await navigateTo(`/matches/${result.matchId}`)
  } catch (caught) {
    toast.add({ title: 'Could not join', description: caught instanceof Error ? caught.message : 'The invitation is no longer available.', color: 'error' })
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-2xl items-center px-5 py-12">
    <div class="game-panel w-full overflow-hidden rounded-2xl">
      <div class="bg-primary-600 p-8 text-white sm:p-10">
        <div class="grid size-12 place-items-center rounded-xl bg-white/15">
          <UIcon
            name="i-lucide-mail-open"
            class="size-6"
          />
        </div>
        <p class="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary-100">
          Private invitation
        </p>
        <h1 class="mt-2 font-display text-4xl font-extrabold tracking-tight">
          You’re invited to game night.
        </h1>
      </div>
      <div class="p-8 sm:p-10">
        <div
          v-if="status === 'pending'"
          class="grid min-h-40 place-items-center"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-7 animate-spin text-primary-600"
          />
        </div>
        <UAlert
          v-else-if="route.query.status === 'unavailable' || error || !data?.invite"
          color="error"
          title="Invitation unavailable"
          description="Ask the host for a fresh link. The match may have started, filled up, or the link may have expired."
        />
        <template v-else>
          <div class="flex items-center gap-4 rounded-xl bg-slate-50 p-5">
            <div class="grid size-12 place-items-center rounded-lg bg-primary-50 font-mono text-xl font-black text-primary-700">
              BG
            </div>
            <div>
              <p class="text-sm text-slate-500">
                {{ data.invite.gameName }} match
              </p><h2 class="font-display text-2xl font-bold">
                {{ data.invite.matchName }}
              </h2>
            </div>
          </div>
          <p class="mt-5 text-sm leading-6 text-slate-600">
            Joining adds your approved Clerk account to this match. The invite can be used by other approved players until the host starts.
          </p>
          <UButton
            size="xl"
            block
            trailing-icon="i-lucide-arrow-right"
            class="mt-7"
            :loading="joining"
            :disabled="!data.invite.available"
            @click="join"
          >
            Join the match
          </UButton>
        </template>
      </div>
    </div>
  </div>
</template>
