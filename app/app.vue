<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'en-US' }
})

const title = 'Mind Boggling'
const description = 'Private game nights for friends and family.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary'
})
</script>

<template>
  <UApp>
    <PlatformAppHeader />
    <UMain class="min-h-[calc(100vh-4.75rem)] bg-slate-50">
      <NuxtPage />
    </UMain>
  </UApp>
</template>
