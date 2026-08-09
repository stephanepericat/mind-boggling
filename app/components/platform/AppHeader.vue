<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const links = computed(() => [
  { label: 'Games', to: '/', active: route.path === '/' || route.path.startsWith('/games') },
  { label: 'Match history', to: '/history', active: route.path.startsWith('/history') }
])
</script>

<template>
  <header class="sticky top-0 z-40 h-[4.75rem] border-b border-slate-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
      <NuxtLink
        to="/"
        aria-label="Mind Boggling home"
      >
        <AppLogo />
      </NuxtLink>

      <nav
        class="hidden items-center gap-2 sm:flex"
        aria-label="Primary navigation"
      >
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :variant="link.active ? 'soft' : 'ghost'"
          :color="link.active ? 'primary' : 'neutral'"
        >
          {{ link.label }}
        </UButton>
      </nav>

      <div class="flex items-center gap-2">
        <UButton
          to="/account"
          color="neutral"
          variant="ghost"
          icon="i-lucide-settings"
          aria-label="Account settings"
        />
        <ClientOnly>
          <template v-if="config.public.demoMode">
            <UAvatar
              text="DP"
              size="sm"
              class="bg-amber-300 text-slate-900"
            />
          </template>
          <Show
            v-else
            when="signed-in"
          >
            <UserButton />
          </Show>
          <Show
            v-if="!config.public.demoMode"
            when="signed-out"
          >
            <UButton
              to="/sign-in"
              size="sm"
            >
              Sign in
            </UButton>
          </Show>
        </ClientOnly>
      </div>
    </div>
  </header>
</template>
