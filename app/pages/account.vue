<script setup lang="ts">
import AccountPanel from '~/components/account/AccountPanel.vue'
</script>

<template>
  <PlatformAuthGate>
    <AccountPanel />
  </PlatformAuthGate>
</template>
