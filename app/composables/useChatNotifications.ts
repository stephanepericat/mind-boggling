import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import type { ChatMessage } from '../../shared/platform/chat'

export function useChatNotifications(
  latestMessage: MaybeRefOrGetter<ChatMessage | null>,
  viewerMemberId: MaybeRefOrGetter<string | undefined>
) {
  const toast = useToast()

  watch(
    () => toValue(latestMessage),
    (message) => {
      if (!message || message.memberId === toValue(viewerMemberId)) return

      toast.add({
        title: `${message.displayName} sent a message`,
        description: message.text.length > 140 ? `${message.text.slice(0, 137)}…` : message.text,
        color: 'info',
        icon: 'i-lucide-message-circle'
      })
      playChatNotificationSound()
    }
  )
}
