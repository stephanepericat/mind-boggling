import type { MatchCommand } from '../../shared/games/boggle/schema'
import type { ChatMessage, ChatSendCommand } from '../../shared/platform/chat'
import type { MatchView, RealtimeEnvelope } from '../../shared/types/api'

interface SnapshotResponse {
  state: MatchView
  serverTime: number
  chatMessages: ChatMessage[]
}

export function useMatchRealtime(matchId: MaybeRefOrGetter<string>) {
  const state = shallowRef<MatchView | null>(null)
  const connected = shallowRef(false)
  const loading = shallowRef(true)
  const error = shallowRef<string | null>(null)
  const serverOffset = shallowRef(0)
  const chatMessages = shallowRef<ChatMessage[]>([])
  const latestChatMessage = shallowRef<ChatMessage | null>(null)
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  let disposed = false

  const id = computed(() => toValue(matchId))

  async function load() {
    loading.value = true
    try {
      const response = await $fetch<SnapshotResponse>(`/api/matches/${id.value}`)
      state.value = response.state
      serverOffset.value = response.serverTime - Date.now()
      chatMessages.value = response.chatMessages ?? []
      error.value = null
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to load this match.'
    } finally {
      loading.value = false
    }
  }

  function scheduleReconnect() {
    if (disposed || reconnectTimer) return
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect() {
    if (!import.meta.client || disposed) return
    socket?.close()
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${window.location.host}/api/matches/${id.value}/socket`)
    socket.addEventListener('open', () => {
      connected.value = true
      reconnectAttempts = 0
    })
    socket.addEventListener('message', (message) => {
      try {
        const envelope = JSON.parse(String(message.data)) as RealtimeEnvelope
        receiveEnvelope(envelope)
      } catch {
        error.value = 'A realtime update could not be read.'
      }
    })
    socket.addEventListener('close', () => {
      connected.value = false
      scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      connected.value = false
    })
  }

  function receiveEnvelope(envelope: RealtimeEnvelope) {
    if (envelope.type === 'state.snapshot') state.value = envelope.payload as MatchView
    if (envelope.type === 'chat.history') {
      chatMessages.value = (envelope.payload as { messages: ChatMessage[] }).messages
    }
    if (envelope.type === 'chat.message') {
      const chatMessage = envelope.payload as ChatMessage
      if (!chatMessages.value.some(item => item.id === chatMessage.id)) {
        chatMessages.value = [...chatMessages.value, chatMessage].slice(-100)
        latestChatMessage.value = chatMessage
      }
    }
    if (envelope.type === 'error') {
      const payload = envelope.payload as { code?: string }
      error.value = payload.code?.replaceAll('_', ' ') ?? 'The command was rejected.'
    }
  }

  async function send(command: MatchCommand) {
    error.value = null
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(command))
      return
    }
    await $fetch(`/api/matches/${id.value}/command`, { method: 'POST', body: command })
    await load()
  }

  async function sendChat(text: string) {
    const trimmedText = text.trim()
    if (!trimmedText) return

    error.value = null
    const chatCommand: ChatSendCommand = {
      type: 'chat.send',
      idempotencyKey: crypto.randomUUID(),
      text: trimmedText
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(chatCommand))
      return
    }
    try {
      const response = await $fetch<RealtimeEnvelope>(`/api/matches/${id.value}/command`, {
        method: 'POST',
        body: chatCommand
      })
      receiveEnvelope(response)
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'The message could not be sent.'
    }
  }

  function command<T extends Omit<MatchCommand, 'idempotencyKey'>>(value: T): MatchCommand {
    return { ...value, idempotencyKey: crypto.randomUUID() } as MatchCommand
  }

  onMounted(async () => {
    await load()
    connect()
  })

  onScopeDispose(() => {
    disposed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    socket?.close()
  })

  return {
    state,
    connected,
    loading,
    error,
    serverOffset,
    chatMessages,
    latestChatMessage,
    load,
    send,
    sendChat,
    command
  }
}
