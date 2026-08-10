<script setup lang="ts">
import type { ChatMessage } from '../../../shared/platform/chat'

const props = defineProps<{
  messages: readonly ChatMessage[]
  latestMessage: ChatMessage | null
  viewerMemberId: string
  connected: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const isOpen = shallowRef(false)
const draft = shallowRef('')
const unreadCount = shallowRef(0)
const messageList = useTemplateRef<HTMLElement>('messageList')
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

function scrollToLatest() {
  if (!messageList.value) return
  messageList.value.scrollTop = messageList.value.scrollHeight
}

async function openChat() {
  isOpen.value = true
  unreadCount.value = 0
  await nextTick()
  scrollToLatest()
}

function closeChat() {
  isOpen.value = false
}

function submitMessage() {
  const message = draft.value.trim()
  if (!message) return
  emit('send', message)
  draft.value = ''
}

watch(
  () => props.latestMessage,
  async (message, previousMessage) => {
    if (!message || message.id === previousMessage?.id) return
    if (!isOpen.value && message.memberId !== props.viewerMemberId) unreadCount.value += 1
    await nextTick()
    scrollToLatest()
  }
)
</script>

<template>
  <aside
    class="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6"
    aria-label="Game chat"
  >
    <section
      v-show="isOpen"
      class="game-panel flex h-[min(28rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl shadow-xl"
    >
      <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700">
            <UIcon
              name="i-lucide-message-circle"
              class="size-5"
              aria-hidden="true"
            />
          </span>
          <div class="min-w-0">
            <h2 class="font-display font-bold text-slate-950">
              Game chat
            </h2>
            <p class="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                class="size-1.5 rounded-full"
                :class="connected ? 'bg-emerald-500' : 'bg-amber-500'"
              />
              {{ connected ? 'Live' : 'Reconnecting' }}
            </p>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Close game chat"
          @click="closeChat"
        />
      </header>

      <div
        ref="messageList"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
      >
        <div
          v-if="messages.length === 0"
          class="grid h-full place-items-center px-6 text-center"
        >
          <div>
            <UIcon
              name="i-lucide-messages-square"
              class="mx-auto size-8 text-slate-300"
              aria-hidden="true"
            />
            <p class="mt-3 text-sm font-semibold text-slate-700">
              No messages yet
            </p>
            <p class="mt-1 text-xs text-slate-500">
              Say hello to everyone at the table.
            </p>
          </div>
        </div>
        <article
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.memberId === viewerMemberId ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm"
            :class="message.memberId === viewerMemberId
              ? 'rounded-br-md bg-primary-600 text-white'
              : 'rounded-bl-md border border-slate-200 bg-white text-slate-900'"
          >
            <div class="flex items-baseline justify-between gap-3">
              <p
                class="truncate text-xs font-bold"
                :class="message.memberId === viewerMemberId ? 'text-primary-100' : 'text-primary-700'"
              >
                {{ message.memberId === viewerMemberId ? 'You' : message.displayName }}
              </p>
              <time
                :datetime="new Date(message.sentAt).toISOString()"
                class="shrink-0 text-[0.65rem]"
                :class="message.memberId === viewerMemberId ? 'text-primary-200' : 'text-slate-400'"
              >
                {{ timeFormatter.format(message.sentAt) }}
              </time>
            </div>
            <p class="mt-1 whitespace-pre-wrap break-words">
              {{ message.text }}
            </p>
          </div>
        </article>
      </div>

      <form
        class="flex gap-2 border-t border-slate-200 bg-white p-3"
        @submit.prevent="submitMessage"
      >
        <UInput
          v-model="draft"
          class="min-w-0 flex-1"
          maxlength="500"
          autocomplete="off"
          placeholder="Message everyone…"
          aria-label="Chat message"
        />
        <UButton
          type="submit"
          icon="i-lucide-send"
          :disabled="!draft.trim()"
          aria-label="Send chat message"
        />
      </form>
    </section>

    <UButton
      v-show="!isOpen"
      size="xl"
      class="relative rounded-full shadow-lg"
      icon="i-lucide-message-circle"
      aria-label="Open game chat"
      @click="openChat"
    >
      Chat
      <span
        v-if="unreadCount > 0"
        class="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-bold leading-4 text-white ring-2 ring-white"
        aria-label="Unread chat messages"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </UButton>
  </aside>
</template>
