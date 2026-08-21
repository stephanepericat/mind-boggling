/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from 'cloudflare:workers'
import {
  BOGGLE_ROUND_COUNTDOWN_MS,
  findMissedWords,
  generateBoard,
  matchCommandSchema,
  scoreRound,
  validateWord
} from '../../../shared/games/boggle'
import type { MatchCommand } from '../../../shared/games/boggle/schema'
import { chatSendSchema } from '../../../shared/platform/chat'
import type { ChatMessage, ChatSendCommand } from '../../../shared/platform/chat'
import type { MatchView, RealtimeEnvelope } from '../../../shared/types/api'
import type { ConnectionAttachment, InitializeRoomInput, RoomMember, RoomSnapshotResponse, RoomState } from './types'
import { projectRoomState } from './projection'

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function parseAttachment(socket: WebSocket): ConnectionAttachment | null {
  const value = socket.deserializeAttachment()
  if (!value || typeof value !== 'object' || !('memberId' in value)) return null
  return value as ConnectionAttachment
}

type ChatMessageRow = {
  id: number
  member_id: string
  display_name: string
  message_text: string
  sent_at: number
}

export class MatchRoom extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          state_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS processed_commands (
          idempotency_key TEXT PRIMARY KEY,
          processed_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS finalization_outbox (
          idempotency_key TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          delivered_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          member_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          message_text TEXT NOT NULL,
          sent_at INTEGER NOT NULL
        );
      `)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/initialize') {
      return this.initialize(await request.json<InitializeRoomInput>())
    }
    if (request.method === 'POST' && url.pathname === '/member') {
      return this.upsertMember(await request.json<RoomMember>())
    }
    if (request.method === 'GET' && url.pathname === '/snapshot') {
      return this.snapshot(request.headers.get('x-member-id'))
    }
    if (request.method === 'POST' && url.pathname === '/command') {
      return this.command(request.headers.get('x-member-id'), await request.json())
    }
    if (request.headers.get('Upgrade') === 'websocket' && url.pathname === '/connect') {
      return this.connectWebSocket(request.headers.get('x-member-id'))
    }
    return json({ error: 'not_found' }, 404)
  }

  async alarm(): Promise<void> {
    const state = this.readState()
    if (!state) return
    if (state.status === 'finished') {
      await this.persistFinalization(state)
      return
    }
    if (state.status !== 'active' || !state.roundEndsAt) return
    if (Date.now() < state.roundEndsAt) {
      await this.ctx.storage.setAlarm(state.roundEndsAt)
      return
    }
    await this.finalizeRound(state)
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = parseAttachment(socket)
    if (!attachment) {
      socket.close(1008, 'Missing membership')
      return
    }
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
      const command = JSON.parse(text)
      const response = await this.handleMessage(attachment.memberId, command, socket)
      socket.send(JSON.stringify(response))
    } catch {
      socket.send(JSON.stringify({ type: 'error', payload: { code: 'invalid_message' } }))
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    socket.close(code, reason)
    const state = this.readState()
    if (state) this.broadcastSnapshots(state)
  }

  private initialize(input: InitializeRoomInput): Response {
    if (this.readState()) return json({ ok: true, created: false })
    const state: RoomState = {
      ...input.state,
      status: 'lobby',
      currentRound: 0,
      submissions: [],
      cumulativeScores: {},
      sequence: 1
    }
    this.writeState(state)
    return json({ ok: true, created: true })
  }

  private upsertMember(member: RoomMember): Response {
    const state = this.requireState()
    if (state.status !== 'lobby') return json({ error: 'match_already_started' }, 409)
    const existing = state.members.find(item => item.id === member.id)
    if (existing) Object.assign(existing, member)
    else state.members.push(member)
    state.sequence += 1
    this.writeState(state)
    this.broadcastSnapshots(state)
    return json({ ok: true })
  }

  private snapshot(memberId: string | null): Response {
    if (!memberId) return json({ error: 'unauthorized' }, 401)
    const state = this.requireState()
    if (!state.members.some(member => member.id === memberId)) return json({ error: 'forbidden' }, 403)
    const response: RoomSnapshotResponse = {
      state: this.project(state, memberId),
      serverTime: Date.now(),
      chatMessages: this.readChatMessages()
    }
    return json(response)
  }

  private async command(memberId: string | null, body: unknown): Promise<Response> {
    if (!memberId) return json({ error: 'unauthorized' }, 401)
    const result = await this.handleMessage(memberId, body)
    return json(result, result.type === 'error' ? 400 : 200)
  }

  private connectWebSocket(memberId: string | null): Response {
    const state = this.requireState()
    if (!memberId || !state.members.some(member => member.id === memberId)) {
      return json({ error: 'forbidden' }, 403)
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server, [memberId])
    server.serializeAttachment({ memberId, connectedAt: Date.now() } satisfies ConnectionAttachment)
    server.send(JSON.stringify(this.envelope(state, 'state.snapshot', this.project(state, memberId))))
    server.send(JSON.stringify(this.envelope(state, 'chat.history', { messages: this.readChatMessages() })))
    this.broadcastSnapshots(state)
    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(memberId: string, body: unknown, sourceSocket?: WebSocket): Promise<RealtimeEnvelope> {
    const parsedChat = chatSendSchema.safeParse(body)
    if (parsedChat.success) return this.handleChatMessage(memberId, parsedChat.data, sourceSocket)
    return this.handleCommand(memberId, body)
  }

  private handleChatMessage(
    memberId: string,
    command: ChatSendCommand,
    sourceSocket?: WebSocket
  ): RealtimeEnvelope {
    const state = this.requireState()
    const actor = state.members.find(member => member.id === memberId)
    if (!actor) return this.envelope(state, 'error', { code: 'forbidden' })

    const existing = this.ctx.storage.sql
      .exec<ChatMessageRow>(`
        SELECT id, member_id, display_name, message_text, sent_at
        FROM chat_messages
        WHERE idempotency_key = ?
      `, command.idempotencyKey)
      .toArray()[0]
    if (existing) return this.envelope(state, 'chat.message', this.toChatMessage(existing))

    const sentAt = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO chat_messages (idempotency_key, member_id, display_name, message_text, sent_at)
       VALUES (?, ?, ?, ?, ?)`,
      command.idempotencyKey,
      memberId,
      actor.displayName,
      command.text,
      sentAt
    )
    const inserted = this.ctx.storage.sql
      .exec<ChatMessageRow>(`
        SELECT id, member_id, display_name, message_text, sent_at
        FROM chat_messages
        WHERE idempotency_key = ?
      `, command.idempotencyKey)
      .toArray()[0]!
    this.ctx.storage.sql.exec(`
      DELETE FROM chat_messages
      WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 100)
    `)

    const envelope = this.envelope(state, 'chat.message', this.toChatMessage(inserted))
    this.broadcastEnvelope(envelope, sourceSocket)
    return envelope
  }

  private async handleCommand(memberId: string, body: unknown): Promise<RealtimeEnvelope> {
    const parsed = matchCommandSchema.safeParse(body)
    const state = this.requireState()
    if (!parsed.success) return this.envelope(state, 'error', { code: 'invalid_command' })
    if (!state.members.some(member => member.id === memberId)) {
      return this.envelope(state, 'error', { code: 'forbidden' })
    }
    const alreadyProcessed = this.ctx.storage.sql
      .exec<{ idempotency_key: string }>('SELECT idempotency_key FROM processed_commands WHERE idempotency_key = ?', parsed.data.idempotencyKey)
      .toArray()[0]
    if (alreadyProcessed) return this.envelope(state, 'command.acknowledged', { duplicate: true })

    const errorCode = await this.applyCommand(state, memberId, parsed.data)
    if (errorCode) return this.envelope(state, 'error', { code: errorCode })

    this.ctx.storage.sql.exec(
      'INSERT INTO processed_commands (idempotency_key, processed_at) VALUES (?, ?)',
      parsed.data.idempotencyKey,
      Date.now()
    )
    state.sequence += 1
    this.writeState(state)
    this.broadcastSnapshots(state)
    return this.envelope(state, 'command.acknowledged', { duplicate: false })
  }

  private async applyCommand(state: RoomState, memberId: string, command: MatchCommand): Promise<string | null> {
    const actor = state.members.find(member => member.id === memberId)!
    if (command.type === 'member.ready') {
      if (state.status !== 'lobby') return 'match_already_started'
      actor.ready = command.ready
      return null
    }

    if (command.type === 'match.start') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'lobby') return 'invalid_state'
      if (state.members.length < 2) return 'not_enough_players'
      if (state.members.some(member => !member.ready)) return 'players_not_ready'
      await this.env.DB.prepare(
        'UPDATE matches SET status = \'active\', started_at = ?1 WHERE id = ?2'
      ).bind(new Date().toISOString(), state.id).run()
      await this.env.DB.prepare(
        'UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL'
      ).bind(new Date().toISOString(), state.id).run()
      await this.startRound(state, 1)
      return null
    }

    if (command.type === 'match.cancel') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'lobby') return 'invalid_state'
      const cancelledAt = new Date().toISOString()
      await this.env.DB.batch([
        this.env.DB.prepare(
          'UPDATE matches SET status = \'cancelled\', ended_at = ?1 WHERE id = ?2 AND status = \'lobby\''
        ).bind(cancelledAt, state.id),
        this.env.DB.prepare(
          'UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL'
        ).bind(cancelledAt, state.id)
      ])
      state.status = 'cancelled'
      return null
    }

    if (command.type === 'member.remove') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'lobby') return 'invalid_state'
      if (command.memberId === state.hostMemberId) return 'cannot_remove_host'
      const target = state.members.find(member => member.id === command.memberId)
      if (!target) return 'member_not_found'
      state.members = state.members.filter(member => member.id !== command.memberId)
      await this.env.DB.prepare(`
        UPDATE match_members SET removed_at = ?1 WHERE match_id = ?2 AND id = ?3
      `).bind(new Date().toISOString(), state.id, command.memberId).run()
      for (const socket of this.ctx.getWebSockets(command.memberId)) socket.close(1008, 'Removed by host')
      return null
    }

    if (command.type === 'boggle.word.submit') {
      const now = Date.now()
      if (
        state.status !== 'active'
        || !state.board
        || !state.roundStartedAt
        || !state.roundEndsAt
        || now < state.roundStartedAt
        || now >= state.roundEndsAt
      ) {
        return 'round_not_active'
      }
      const validation = validateWord(state.board, state.settings, command.word, command.path)
      if (!validation.valid) return validation.rejectionCode ?? 'invalid_word'
      const exists = state.submissions.some(item => item.memberId === memberId && item.word === validation.normalizedWord)
      if (exists) return 'word_already_submitted'
      state.submissions.push({
        memberId,
        displayName: actor.displayName,
        word: validation.normalizedWord,
        path: validation.path,
        submittedAt: now
      })
      return null
    }

    if (command.type === 'boggle.round.continue') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'round_results') return 'invalid_state'
      if (state.currentRound >= state.settings.rounds) {
        await this.finishMatch(state)
      } else {
        await this.startRound(state, state.currentRound + 1)
      }
      return null
    }

    if (command.type === 'match.end') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'active' && state.status !== 'round_results') return 'invalid_state'
      if (state.status === 'active') await this.finalizeRound(state)
      await this.finishMatch(state)
      return null
    }
    return 'invalid_command'
  }

  private async startRound(state: RoomState, round: number): Promise<void> {
    const now = Date.now()
    const roundStartedAt = now + BOGGLE_ROUND_COUNTDOWN_MS
    state.status = 'active'
    state.currentRound = round
    state.board = generateBoard(state.settings, crypto.randomUUID())
    state.submissions = []
    state.roundScores = undefined
    state.missedWords = undefined
    state.roundStartedAt = roundStartedAt
    state.roundEndsAt = roundStartedAt + state.settings.roundSeconds * 1000
    await this.ctx.storage.setAlarm(state.roundEndsAt)
  }

  private async finalizeRound(state: RoomState): Promise<void> {
    const scores = scoreRound(state.submissions)
    for (const member of state.members) {
      if (!scores.some(score => score.memberId === member.id)) {
        scores.push({ memberId: member.id, displayName: member.displayName, points: 0, words: [] })
      }
    }
    scores.sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName))
    for (const score of scores) {
      state.cumulativeScores[score.memberId] = (state.cumulativeScores[score.memberId] ?? 0) + score.points
    }
    state.roundScores = scores
    state.missedWords = state.board ? findMissedWords(state.board, state.settings, state.submissions) : []
    state.status = 'round_results'
    state.sequence += 1
    this.writeState(state)
    this.broadcastSnapshots(state)
  }

  private async finishMatch(state: RoomState): Promise<void> {
    state.status = 'finished'
    state.roundEndsAt = undefined
    state.sequence += 1
    this.writeState(state)
    await this.ctx.storage.deleteAlarm()
    await this.persistFinalization(state)
  }

  private async persistFinalization(state: RoomState): Promise<void> {
    const finalizedAt = new Date().toISOString()
    const ranked = [...state.members]
      .sort((left, right) => (state.cumulativeScores[right.id] ?? 0) - (state.cumulativeScores[left.id] ?? 0) || left.displayName.localeCompare(right.displayName))
    const payload = { matchId: state.id, finalizedAt, ranked }
    const idempotencyKey = `match:${state.id}:final`
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO finalization_outbox (idempotency_key, payload_json) VALUES (?, ?)',
      idempotencyKey,
      JSON.stringify(payload)
    )

    const participantNames = ranked.map(member => member.displayName)
    const statements: D1PreparedStatement[] = [
      this.env.DB.prepare('UPDATE matches SET status = \'finished\', ended_at = ?1 WHERE id = ?2').bind(finalizedAt, state.id)
    ]
    ranked.forEach((member, index) => {
      const score = state.cumulativeScores[member.id] ?? 0
      statements.push(
        this.env.DB.prepare(`
          INSERT INTO score_projections
            (idempotency_key, match_id, member_id, score, rank, payload_json, finalized_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          ON CONFLICT(match_id, member_id) DO UPDATE SET
            score = excluded.score,
            rank = excluded.rank,
            payload_json = excluded.payload_json,
            finalized_at = excluded.finalized_at
        `).bind(`${idempotencyKey}:${member.id}`, state.id, member.id, score, index + 1, JSON.stringify({ rounds: state.currentRound }), finalizedAt),
        this.env.DB.prepare(`
          INSERT INTO player_match_summaries
            (match_id, clerk_user_id, match_name, game_key, placement, score, participants_json, completed_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(match_id, clerk_user_id) DO UPDATE SET
            placement = excluded.placement,
            score = excluded.score,
            participants_json = excluded.participants_json,
            completed_at = excluded.completed_at
        `).bind(state.id, member.clerkUserId, state.name, state.gameKey, index + 1, score, JSON.stringify(participantNames), finalizedAt)
      )
    })
    try {
      await this.env.DB.batch(statements)
      this.ctx.storage.sql.exec(
        'UPDATE finalization_outbox SET delivered_at = ? WHERE idempotency_key = ?',
        Date.now(),
        idempotencyKey
      )
      await this.ctx.storage.deleteAlarm()
    } catch (error) {
      console.error(JSON.stringify({ message: 'match finalization delivery failed', matchId: state.id, error: String(error) }))
      await this.ctx.storage.setAlarm(Date.now() + 30_000)
    }
  }

  private readState(): RoomState | null {
    const row = this.ctx.storage.sql
      .exec<{ state_json: string }>('SELECT state_json FROM room_state WHERE singleton = 1')
      .toArray()[0]
    return row ? JSON.parse(row.state_json) as RoomState : null
  }

  private requireState(): RoomState {
    const state = this.readState()
    if (!state) throw new Error('Room is not initialized')
    return state
  }

  private readChatMessages(): ChatMessage[] {
    return this.ctx.storage.sql
      .exec<ChatMessageRow>(`
        SELECT id, member_id, display_name, message_text, sent_at
        FROM chat_messages
        ORDER BY id DESC
        LIMIT 100
      `)
      .toArray()
      .reverse()
      .map(row => this.toChatMessage(row))
  }

  private toChatMessage(row: ChatMessageRow): ChatMessage {
    return {
      id: String(row.id),
      memberId: row.member_id,
      displayName: row.display_name,
      text: row.message_text,
      sentAt: row.sent_at
    }
  }

  private writeState(state: RoomState): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO room_state (singleton, state_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      JSON.stringify(state),
      Date.now()
    )
  }

  private project(state: RoomState, viewerMemberId: string): MatchView {
    const connected = new Set(
      this.ctx.getWebSockets().map(socket => parseAttachment(socket)?.memberId).filter((value): value is string => Boolean(value))
    )
    return projectRoomState(state, viewerMemberId, connected)
  }

  private envelope(state: RoomState, type: string, payload: unknown): RealtimeEnvelope {
    return {
      version: 1,
      matchId: state.id,
      gameKey: state.gameKey,
      sequence: state.sequence,
      occurredAt: new Date().toISOString(),
      type,
      payload
    }
  }

  private broadcastEnvelope(envelope: RealtimeEnvelope, excludedSocket?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === excludedSocket) continue
      try {
        socket.send(JSON.stringify(envelope))
      } catch (error) {
        console.error(JSON.stringify({
          message: 'websocket event broadcast failed',
          matchId: envelope.matchId,
          eventType: envelope.type,
          error: String(error)
        }))
      }
    }
  }

  private broadcastSnapshots(state: RoomState): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = parseAttachment(socket)
      if (!attachment) continue
      try {
        socket.send(JSON.stringify(this.envelope(state, 'state.snapshot', this.project(state, attachment.memberId))))
      } catch (error) {
        console.error(JSON.stringify({ message: 'websocket broadcast failed', matchId: state.id, error: String(error) }))
      }
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return json({ error: 'not_found' }, 404)
  }
} satisfies ExportedHandler<Cloudflare.Env>
