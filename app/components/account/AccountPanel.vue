<script setup lang="ts">
const config = useRuntimeConfig()
const toast = useToast()
const saving = ref(false)
const { data, refresh } = await useFetch<{ user: { clerkUserId: string, displayName: string } }>('/api/me')
const displayName = ref('')

watchEffect(() => {
  if (data.value?.user.displayName && !displayName.value) displayName.value = data.value.user.displayName
})

async function save() {
  saving.value = true
  try {
    await $fetch('/api/me', { method: 'PATCH', body: { displayName: displayName.value } })
    await refresh()
    toast.add({ title: 'Display name updated', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Name not updated', description: error instanceof Error ? error.message : 'Try again.', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1040px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
    <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
      Your account
    </p>
    <h1 class="mt-2 font-display text-4xl font-extrabold tracking-tight">
      How players see you.
    </h1>
    <p class="mt-2 text-slate-600">
      Your friendly name appears in lobbies and scoreboards. Password and security stay with Clerk.
    </p>

    <div class="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <form
        class="game-panel h-fit rounded-xl p-6"
        @submit.prevent="save"
      >
        <div class="grid size-12 place-items-center rounded-xl bg-amber-300 font-display text-lg font-black">
          {{ displayName.slice(0, 2).toUpperCase() || 'PL' }}
        </div>
        <h2 class="mt-5 font-display text-xl font-bold">
          Friendly display name
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          2–32 characters. It does not need to be unique.
        </p>
        <UFormField
          label="Display name"
          class="mt-5"
        >
          <UInput
            v-model="displayName"
            maxlength="32"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          block
          class="mt-5"
          :loading="saving"
        >
          Save display name
        </UButton>
      </form>

      <div class="game-panel min-h-96 overflow-hidden rounded-xl p-2">
        <div
          v-if="config.public.demoMode"
          class="grid min-h-80 place-items-center p-8 text-center"
        >
          <div>
            <UIcon
              name="i-lucide-shield-check"
              class="mx-auto size-8 text-primary-600"
            /><h2 class="mt-3 font-display text-xl font-bold">
              Clerk account controls
            </h2><p class="mt-2 text-sm text-slate-500">
              Disable demo mode to manage passwords here.
            </p>
          </div>
        </div>
        <ClientOnly v-else>
          <UserProfile routing="hash" />
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
