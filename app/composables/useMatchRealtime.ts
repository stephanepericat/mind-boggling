import type { MatchCommand } from '../../shared/platform/commands'
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
  let fallbackPoll: ReturnType<typeof setInterval> | undefined
  let reconnectAttempts = 0
  let disposed = false

  const id = computed(() => toValue(matchId))

  function acceptSnapshot(snapshot: MatchView) {
    if (snapshot.id !== id.value) return false
    if (state.value?.id === snapshot.id && state.value.sequence > snapshot.sequence) return false
    state.value = snapshot
    return true
  }

  async function load(showLoading = true) {
    if (showLoading) loading.value = true
    try {
      const response = await $fetch<SnapshotResponse>(`/api/matches/${id.value}`)
      if (acceptSnapshot(response.state)) {
        serverOffset.value = response.serverTime - Date.now()
        chatMessages.value = response.chatMessages ?? []
        if (showLoading) error.value = null
      }
    } catch (caught) {
      if (showLoading) error.value = caught instanceof Error ? caught.message : 'Unable to load this match.'
    } finally {
      if (showLoading) loading.value = false
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
    const current = new WebSocket(`${protocol}//${window.location.host}/api/matches/${id.value}/socket`)
    socket = current
    current.addEventListener('open', () => {
      if (socket !== current) return
      connected.value = true
      reconnectAttempts = 0
    })
    current.addEventListener('message', (message) => {
      if (socket !== current) return
      try {
        const envelope = JSON.parse(String(message.data)) as RealtimeEnvelope
        receiveEnvelope(envelope)
      } catch {
        error.value = 'A realtime update could not be read.'
      }
    })
    current.addEventListener('close', () => {
      if (socket !== current) return
      connected.value = false
      scheduleReconnect()
    })
    current.addEventListener('error', () => {
      if (socket !== current) return
      connected.value = false
    })
  }

  function receiveEnvelope(envelope: RealtimeEnvelope) {
    if (envelope.type === 'state.snapshot') acceptSnapshot(envelope.payload as MatchView)
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
    const holdemRoom = state.value?.gameKey === 'texas-holdem.v1'
    await $fetch(`/api/matches/${id.value}/command`, { method: 'POST', body: command }).catch(async (caught) => {
      if (holdemRoom) await load(false)
      throw caught
    })
    await load(!holdemRoom)
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
    fallbackPoll = setInterval(() => {
      if (!connected.value && state.value?.gameKey === 'texas-holdem.v1' && state.value.status === 'active') void load(false)
    }, 2000)
  })

  onScopeDispose(() => {
    disposed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    clearInterval(fallbackPoll)
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
