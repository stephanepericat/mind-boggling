<script setup lang="ts">
const route = useRoute()
const matchId = computed(() => String(route.params.id))
</script>

<template>
  <PlatformAuthGate>
    <MatchRoom :match-id="matchId" />
  </PlatformAuthGate>
</template>
