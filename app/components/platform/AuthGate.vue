<script setup lang="ts">
const config = useRuntimeConfig()
const route = useRoute()
const signInUrl = computed(() => `/sign-in?redirect_url=${encodeURIComponent(route.fullPath)}`)
</script>

<template>
  <slot v-if="config.public.demoMode" />
  <ClientOnly v-else>
    <SignedIn>
      <slot />
    </SignedIn>
    <SignedOut>
      <div class="mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-lg items-center px-6 py-16">
        <div class="w-full text-center">
          <div class="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-primary-50 text-primary-700">
            <UIcon
              name="i-lucide-lock-keyhole"
              class="size-8"
            />
          </div>
          <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
            Private game night
          </p>
          <h1 class="font-display text-4xl font-extrabold tracking-tight">
            Your seat is waiting.
          </h1>
          <p class="mx-auto mt-4 max-w-md text-slate-600">
            Mind Boggling is invite-only. Sign in with the Clerk account your host invited.
          </p>
          <UButton
            :to="signInUrl"
            size="xl"
            trailing-icon="i-lucide-arrow-right"
            class="mt-8"
          >
            Sign in to play
          </UButton>
        </div>
      </div>
    </SignedOut>
    <template #fallback>
      <div class="grid min-h-[60vh] place-items-center">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-7 animate-spin text-primary-600"
        />
      </div>
    </template>
  </ClientOnly>
</template>
