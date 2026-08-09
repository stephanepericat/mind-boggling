<script setup lang="ts">
onMounted(() => navigateTo('/join?status=unavailable', { replace: true }))
</script>

<template>
  <div class="grid min-h-[60vh] place-items-center">
    <UIcon
      name="i-lucide-loader-circle"
      class="size-7 animate-spin text-primary-600"
    />
  </div>
</template>
