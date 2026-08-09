<script setup lang="ts">
const props = defineProps<{ matchName: string, loading: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
const open = shallowRef(false)

function confirmCancellation() {
  emit('confirm')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cancel this match?"
    :description="`${props.matchName} will close for everyone at the table.`"
    :dismissible="!loading"
    :close="!loading"
  >
    <UButton
      color="error"
      variant="outline"
      icon="i-lucide-circle-x"
      :loading="loading"
      class="w-full justify-center"
    >
      Cancel match
    </UButton>

    <template #body>
      <p class="text-sm text-slate-600">
        Players will no longer be able to join or start this match. This action cannot be undone.
      </p>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-3">
        <UButton
          color="neutral"
          variant="outline"
          :disabled="loading"
          @click="close"
        >
          Keep match
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-circle-x"
          :loading="loading"
          @click="confirmCancellation"
        >
          Yes, cancel match
        </UButton>
      </div>
    </template>
  </UModal>
</template>
