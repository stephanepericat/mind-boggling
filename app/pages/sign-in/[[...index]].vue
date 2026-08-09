<script setup lang="ts">
const route = useRoute()
const redirectUrl = computed(() => typeof route.query.redirect_url === 'string' && route.query.redirect_url.startsWith('/') ? route.query.redirect_url : '/')
</script>

<template>
  <div class="grid min-h-[calc(100vh-4.75rem)] place-items-center px-5 py-12">
    <ClientOnly>
      <SignIn
        routing="path"
        path="/sign-in"
        :fallback-redirect-url="redirectUrl"
        sign-up-url="/access-required"
      />
    </ClientOnly>
  </div>
</template>
