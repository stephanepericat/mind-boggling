<script setup lang="ts">
import HistoryList from '~/components/history/HistoryList.vue'
</script>

<template>
  <PlatformAuthGate>
    <HistoryList />
  </PlatformAuthGate>
</template>
