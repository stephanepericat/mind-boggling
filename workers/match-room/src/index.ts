/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from 'cloudflare:workers'
import { numericDie } from '../../../shared/dice/numeric'
import { rollDice } from '../../../shared/dice/roller'
import {
  BOGGLE_ROUND_COUNTDOWN_MS,
  boggleCommandSchema,
  findMissedWords,
  generateBoard,
  scoreRound,
  validateWord
} from '../../../shared/games/boggle'
import type { BoggleSettings } from '../../../shared/games/boggle'
import type { BoggleCommand } from '../../../shared/games/boggle/schema'
import {
  bankFarkleTurn,
  continueFarkleTurn,
  createFarkleState,
  FARKLE_DIE_IDS,
  FARKLE_RULES,
  farkleCommandSchema,
  resolveOpeningRolls,
  rollFarkleDice,
  scoreSelection,
  skipFarkleTurn
} from '../../../shared/games/farkle'
import type { FarkleCommand, FarkleSettings } from '../../../shared/games/farkle'
import { chatSendSchema } from '../../../shared/platform/chat'
import type { ChatMessage, ChatSendCommand } from '../../../shared/platform/chat'
import { platformMatchCommandSchema } from '../../../shared/platform/match'
import type { PlatformMatchCommand } from '../../../shared/platform/match'
import type { MatchView, RealtimeEnvelope } from '../../../shared/types/api'
import { uniformInt } from '../../../shared/random/uniform'
import { projectRoomState } from './projection'
import { WebCryptoRandomSource } from './random'
import type {
  ConnectionAttachment,
  InitializeRoomInput,
  RoomMember,
  RoomSnapshotResponse,
  RoomState
} from './types'

type RoomCommand = PlatformMatchCommand | BoggleCommand | FarkleCommand

type ChatMessageRow = {
  id: number
  member_id: string
  display_name: string
  message_text: string
  sent_at: number
}

interface LegacyBoggleRoomState {
  id: string
  name: string
  gameKey: 'boggle.v1'
  status: RoomState['status']
  settings: BoggleSettings
  hostMemberId: string
  currentRound: number
  board?: RoomState['game'] extends { key: 'boggle.v1', state: infer State } ? State : never
  roundStartedAt?: number
  roundEndsAt?: number
  members: RoomMember[]
  submissions: Extract<RoomState['game'], { key: 'boggle.v1' }>['state']['submissions']
  roundScores?: Extract<RoomState['game'], { key: 'boggle.v1' }>['state']['roundScores']
  missedWords?: string[]
  cumulativeScores: Record<string, number>
  sequence: number
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAttachment(socket: WebSocket): ConnectionAttachment | null {
  const value: unknown = socket.deserializeAttachment()
  if (!isRecord(value) || typeof value.memberId !== 'string' || typeof value.connectedAt !== 'number') return null
  return { memberId: value.memberId, connectedAt: value.connectedAt }
}

function isVersionedRoomState(value: unknown): value is RoomState {
  return isRecord(value)
    && value.stateVersion === 2
    && typeof value.id === 'string'
    && Array.isArray(value.members)
    && isRecord(value.game)
    && (value.game.key === 'boggle.v1' || value.game.key === 'farkle.v1')
}

function isLegacyBoggleRoomState(value: unknown): value is LegacyBoggleRoomState {
  return isRecord(value)
    && value.gameKey === 'boggle.v1'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.members)
    && Array.isArray(value.submissions)
    && isRecord(value.settings)
}

function migrateLegacyState(legacy: LegacyBoggleRoomState): RoomState {
  return {
    stateVersion: 2,
    id: legacy.id,
    name: legacy.name,
    status: legacy.status,
    hostMemberId: legacy.hostMemberId,
    members: legacy.members,
    sequence: legacy.sequence,
    presence: Object.fromEntries(legacy.members.map(member => [member.id, { lastActivityAt: 0 }])),
    game: {
      key: 'boggle.v1',
      settings: legacy.settings,
      state: {
        currentRound: legacy.currentRound,
        board: isRecord(legacy.board) && 'tiles' in legacy.board
          ? legacy.board as Extract<RoomState['game'], { key: 'boggle.v1' }>['state']['board']
          : undefined,
        roundStartedAt: legacy.roundStartedAt,
        roundEndsAt: legacy.roundEndsAt,
        submissions: legacy.submissions,
        roundScores: legacy.roundScores,
        missedWords: legacy.missedWords,
        cumulativeScores: legacy.cumulativeScores
      }
    }
  }
}

export class MatchRoom extends DurableObject<Cloudflare.Env> {
  private readonly random = new WebCryptoRandomSource()

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
    if (request.method === 'POST' && url.pathname === '/initialize') return this.initialize(await request.json<InitializeRoomInput>())
    if (request.method === 'POST' && url.pathname === '/member') return this.upsertMember(await request.json<RoomMember>())
    if (request.method === 'GET' && url.pathname === '/snapshot') return this.snapshot(request.headers.get('x-member-id'))
    if (request.method === 'POST' && url.pathname === '/command') return this.command(request.headers.get('x-member-id'), await request.json())
    if (request.headers.get('Upgrade') === 'websocket' && url.pathname === '/connect') return this.connectWebSocket(request.headers.get('x-member-id'))
    return json({ error: 'not_found' }, 404)
  }

  async alarm(): Promise<void> {
    const state = this.readState()
    if (!state) return
    if (state.status === 'finished') {
      await this.persistFinalization(state)
      return
    }
    if (state.game.key !== 'boggle.v1') return
    const game = state.game.state
    if (state.status !== 'active' || !game.roundEndsAt) return
    if (Date.now() < game.roundEndsAt) {
      await this.ctx.storage.setAlarm(game.roundEndsAt)
      return
    }
    await this.finalizeBoggleRound(state)
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = parseAttachment(socket)
    if (!attachment) {
      socket.close(1008, 'Missing membership')
      return
    }
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
      const response = await this.handleMessage(attachment.memberId, JSON.parse(text), socket)
      socket.send(JSON.stringify(response))
    } catch {
      socket.send(JSON.stringify({ type: 'error', payload: { code: 'invalid_message' } }))
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    socket.close(code, reason)
    const state = this.readState()
    const attachment = parseAttachment(socket)
    if (!state || !attachment) return
    const hasAnotherSocket = this.ctx.getWebSockets(attachment.memberId)
      .some(candidate => candidate !== socket && candidate.readyState === WebSocket.OPEN)
    if (!hasAnotherSocket) {
      const now = Date.now()
      state.presence[attachment.memberId] = {
        lastActivityAt: state.presence[attachment.memberId]?.lastActivityAt ?? now,
        disconnectedAt: now
      }
      state.sequence += 1
      this.writeState(state)
    }
    this.broadcastSnapshots(state)
  }

  private initialize(input: InitializeRoomInput): Response {
    if (this.readState()) return json({ ok: true, created: false })
    const now = Date.now()
    const common = {
      stateVersion: 2 as const,
      id: input.state.id,
      name: input.state.name,
      status: 'lobby' as const,
      hostMemberId: input.state.hostMemberId,
      members: input.state.members,
      sequence: 1,
      presence: Object.fromEntries(input.state.members.map(member => [member.id, { lastActivityAt: now, disconnectedAt: now }]))
    }
    const state: RoomState = input.state.gameKey === 'boggle.v1'
      ? {
          ...common,
          game: {
            key: 'boggle.v1',
            settings: input.state.settings as BoggleSettings,
            state: { currentRound: 0, submissions: [], cumulativeScores: {} }
          }
        }
      : {
          ...common,
          game: { key: 'farkle.v1', settings: input.state.settings as FarkleSettings, state: null }
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
    state.presence[member.id] ??= { lastActivityAt: Date.now(), disconnectedAt: Date.now() }
    state.sequence += 1
    this.writeState(state)
    this.broadcastSnapshots(state)
    return json({ ok: true })
  }

  private snapshot(memberId: string | null): Response {
    if (!memberId) return json({ error: 'unauthorized' }, 401)
    const state = this.requireState()
    if (!state.members.some(member => member.id === memberId)) return json({ error: 'forbidden' }, 403)
    this.touchActivity(state, memberId, Date.now())
    this.writeState(state)
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
    if (!memberId || !state.members.some(member => member.id === memberId)) return json({ error: 'forbidden' }, 403)
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const now = Date.now()
    this.ctx.acceptWebSocket(server, [memberId])
    server.serializeAttachment({ memberId, connectedAt: now } satisfies ConnectionAttachment)
    state.presence[memberId] = { lastActivityAt: now }
    state.sequence += 1
    this.writeState(state)
    server.send(JSON.stringify(this.envelope(state, 'state.snapshot', this.project(state, memberId))))
    server.send(JSON.stringify(this.envelope(state, 'chat.history', { messages: this.readChatMessages() })))
    this.broadcastSnapshots(state)
    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(memberId: string, body: unknown, sourceSocket?: WebSocket): Promise<RealtimeEnvelope> {
    const state = this.requireState()
    if (!state.members.some(member => member.id === memberId)) return this.envelope(state, 'error', { code: 'forbidden' })
    this.touchActivity(state, memberId, Date.now())
    this.writeState(state)
    const parsedChat = chatSendSchema.safeParse(body)
    if (parsedChat.success) return this.handleChatMessage(state, memberId, parsedChat.data, sourceSocket)
    return this.handleCommand(state, memberId, body)
  }

  private touchActivity(state: RoomState, memberId: string, now: number): void {
    const connected = this.ctx.getWebSockets(memberId).some(socket => socket.readyState === WebSocket.OPEN)
    state.presence[memberId] = connected ? { lastActivityAt: now } : { lastActivityAt: now, disconnectedAt: now }
  }

  private handleChatMessage(state: RoomState, memberId: string, command: ChatSendCommand, sourceSocket?: WebSocket): RealtimeEnvelope {
    const actor = state.members.find(member => member.id === memberId)!
    const existing = this.ctx.storage.sql.exec<ChatMessageRow>(`
      SELECT id, member_id, display_name, message_text, sent_at FROM chat_messages WHERE idempotency_key = ?
    `, command.idempotencyKey).toArray()[0]
    if (existing) return this.envelope(state, 'chat.message', this.toChatMessage(existing))

    const sentAt = Date.now()
    this.ctx.storage.sql.exec(
      `INSERT INTO chat_messages (idempotency_key, member_id, display_name, message_text, sent_at) VALUES (?, ?, ?, ?, ?)`,
      command.idempotencyKey,
      memberId,
      actor.displayName,
      command.text,
      sentAt
    )
    const inserted = this.ctx.storage.sql.exec<ChatMessageRow>(`
      SELECT id, member_id, display_name, message_text, sent_at FROM chat_messages WHERE idempotency_key = ?
    `, command.idempotencyKey).toArray()[0]!
    this.ctx.storage.sql.exec(`DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 100)`)
    const envelope = this.envelope(state, 'chat.message', this.toChatMessage(inserted))
    this.broadcastEnvelope(envelope, sourceSocket)
    return envelope
  }

  private parseRoomCommand(state: RoomState, body: unknown): RoomCommand | null {
    const platform = platformMatchCommandSchema.safeParse(body)
    if (platform.success) return platform.data
    if (state.game.key === 'boggle.v1') {
      const boggle = boggleCommandSchema.safeParse(body)
      return boggle.success ? boggle.data : null
    }
    const farkle = farkleCommandSchema.safeParse(body)
    return farkle.success ? farkle.data : null
  }

  private async handleCommand(state: RoomState, memberId: string, body: unknown): Promise<RealtimeEnvelope> {
    const command = this.parseRoomCommand(state, body)
    if (!command) return this.envelope(state, 'error', { code: 'invalid_command' })
    const alreadyProcessed = this.ctx.storage.sql.exec<{ idempotency_key: string }>(
      'SELECT idempotency_key FROM processed_commands WHERE idempotency_key = ?',
      command.idempotencyKey
    ).toArray()[0]
    if (alreadyProcessed) return this.envelope(state, 'command.acknowledged', { duplicate: true })

    const errorCode = command.type.startsWith('boggle.') || command.type.startsWith('farkle.')
      ? await this.applyGameCommand(state, memberId, command as BoggleCommand | FarkleCommand)
      : await this.applyPlatformCommand(state, memberId, command as PlatformMatchCommand)
    if (errorCode) return this.envelope(state, 'error', { code: errorCode })

    this.ctx.storage.sql.exec(
      'INSERT INTO processed_commands (idempotency_key, processed_at) VALUES (?, ?)',
      command.idempotencyKey,
      Date.now()
    )
    state.sequence += 1
    this.writeState(state)
    if (state.status === 'finished') await this.persistFinalization(state)
    this.broadcastSnapshots(state)
    return this.envelope(state, 'command.acknowledged', { duplicate: false })
  }

  private async applyPlatformCommand(state: RoomState, memberId: string, command: PlatformMatchCommand): Promise<string | null> {
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
      const startedAt = new Date().toISOString()
      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE matches SET status = 'active', started_at = ?1 WHERE id = ?2`).bind(startedAt, state.id),
        this.env.DB.prepare(`UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL`).bind(startedAt, state.id)
      ])
      if (state.game.key === 'boggle.v1') await this.startBoggleRound(state, 1)
      else this.startFarkle(state)
      return null
    }
    if (command.type === 'match.cancel') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'lobby') return 'invalid_state'
      const cancelledAt = new Date().toISOString()
      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE matches SET status = 'cancelled', ended_at = ?1 WHERE id = ?2 AND status = 'lobby'`).bind(cancelledAt, state.id),
        this.env.DB.prepare(`UPDATE invites SET revoked_at = ?1 WHERE match_id = ?2 AND revoked_at IS NULL`).bind(cancelledAt, state.id)
      ])
      state.status = 'cancelled'
      return null
    }
    if (command.type === 'member.remove') {
      if (actor.role !== 'host') return 'host_only'
      if (state.status !== 'lobby') return 'invalid_state'
      if (command.memberId === state.hostMemberId) return 'cannot_remove_host'
      if (!state.members.some(member => member.id === command.memberId)) return 'member_not_found'
      state.members = state.members.filter(member => member.id !== command.memberId)
      const { [command.memberId]: _removedPresence, ...remainingPresence } = state.presence
      state.presence = remainingPresence
      await this.env.DB.prepare(`UPDATE match_members SET removed_at = ?1 WHERE match_id = ?2 AND id = ?3`)
        .bind(new Date().toISOString(), state.id, command.memberId).run()
      for (const socket of this.ctx.getWebSockets(command.memberId)) socket.close(1008, 'Removed by host')
      return null
    }
    if (command.type === 'match.end') {
      if (actor.role !== 'host') return 'host_only'
      if (state.game.key !== 'boggle.v1') return 'invalid_command'
      if (state.status !== 'active' && state.status !== 'round_results') return 'invalid_state'
      if (state.status === 'active') await this.finalizeBoggleRound(state, false)
      await this.finishMatch(state)
      return null
    }
    return 'invalid_command'
  }

  private async applyGameCommand(state: RoomState, memberId: string, command: BoggleCommand | FarkleCommand): Promise<string | null> {
    if (state.game.key === 'boggle.v1') return this.applyBoggleCommand(state, memberId, command as BoggleCommand)
    return this.applyFarkleCommand(state, memberId, command as FarkleCommand)
  }

  private async applyBoggleCommand(state: RoomState, memberId: string, command: BoggleCommand): Promise<string | null> {
    if (state.game.key !== 'boggle.v1') return 'invalid_command'
    const game = state.game.state
    const actor = state.members.find(member => member.id === memberId)!
    if (command.type === 'boggle.word.submit') {
      const now = Date.now()
      if (state.status !== 'active' || !game.board || !game.roundStartedAt || !game.roundEndsAt || now < game.roundStartedAt || now >= game.roundEndsAt) {
        return 'round_not_active'
      }
      const validation = validateWord(game.board, state.game.settings, command.word, command.path)
      if (!validation.valid) return validation.rejectionCode ?? 'invalid_word'
      if (game.submissions.some(item => item.memberId === memberId && item.word === validation.normalizedWord)) return 'word_already_submitted'
      game.submissions.push({
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
      if (game.currentRound >= state.game.settings.rounds) await this.finishMatch(state)
      else await this.startBoggleRound(state, game.currentRound + 1)
      return null
    }
    return 'invalid_command'
  }

  private applyFarkleCommand(state: RoomState, memberId: string, command: FarkleCommand): string | null {
    if (state.game.key !== 'farkle.v1' || state.status !== 'active' || !state.game.state) return 'invalid_state'
    const game = state.game.state
    const now = Date.now()
    let result
    if (command.type === 'farkle.roll') {
      if (!game.turn || game.turn.memberId !== memberId || game.turn.currentRoll) return 'invalid_state'
      result = rollFarkleDice(game, memberId, this.rollFarkleDice(game.turn.availableDieIds, now), now)
    } else if (command.type === 'farkle.continue') {
      const currentRoll = game.turn?.currentRoll
      if (!currentRoll || currentRoll.id !== command.rollId) return 'stale_roll'
      const selected = currentRoll.dice.filter(die => command.selectedDieIds.includes(die.id))
      if (selected.length !== command.selectedDieIds.length || !scoreSelection(selected)) return 'selection_does_not_score'
      const remaining = currentRoll.dice.filter(die => !command.selectedDieIds.includes(die.id)).map(die => die.id)
      const nextDieIds = remaining.length === 0 ? [...FARKLE_DIE_IDS] : remaining
      result = continueFarkleTurn(game, memberId, command.rollId, command.selectedDieIds, this.rollFarkleDice(nextDieIds, now), now)
    } else if (command.type === 'farkle.bank') {
      result = bankFarkleTurn(game, state.game.settings, memberId, command.rollId, command.selectedDieIds, now)
    } else {
      const skipError = this.validateSkip(state, memberId, command.memberId, now)
      if (skipError) return skipError
      result = skipFarkleTurn(game, command.memberId, now)
    }
    if (result.error) return result.error
    state.game.state = result.state
    if (result.state.phase === 'finished') state.status = 'finished'
    return null
  }

  private validateSkip(state: RoomState, actorMemberId: string, targetMemberId: string, now: number): string | null {
    if (state.game.key !== 'farkle.v1' || !state.game.state?.turn) return 'invalid_state'
    const target = state.members.find(member => member.id === targetMemberId)
    const actor = state.members.find(member => member.id === actorMemberId)
    if (!target || !actor || targetMemberId !== state.game.state.turn.memberId || actorMemberId === targetMemberId) return 'invalid_target'
    if (this.isConnected(targetMemberId)) return 'player_connected'
    if (!this.isConnected(actorMemberId)) return 'actor_disconnected'
    if (target.role === 'player' && actor.role !== 'host') return 'host_only'
    const presence = state.presence[targetMemberId]
    if (!presence?.disconnectedAt) return 'skip_not_available'
    const eligibleAt = Math.max(state.game.state.turn.startedAt, presence.disconnectedAt, presence.lastActivityAt) + FARKLE_RULES.disconnectGraceMs
    if (now < eligibleAt) return 'skip_grace_period'
    return null
  }

  private startFarkle(state: RoomState): void {
    if (state.game.key !== 'farkle.v1') return
    const now = Date.now()
    const memberIds = state.members.map(member => member.id)
    const openingRolls = resolveOpeningRolls(
      memberIds,
      () => uniformInt(this.random, 1, 6),
      () => crypto.randomUUID()
    )
    state.game.state = createFarkleState(memberIds, openingRolls, now)
    state.status = 'active'
  }

  private rollFarkleDice(dieIds: readonly string[], rolledAt: number) {
    return rollDice({
      definitions: dieIds.map(id => numericDie(id, 6)),
      source: this.random,
      rollId: crypto.randomUUID(),
      rolledAt
    })
  }

  private async startBoggleRound(state: RoomState, round: number): Promise<void> {
    if (state.game.key !== 'boggle.v1') return
    const now = Date.now()
    const game = state.game.state
    game.currentRound = round
    game.board = generateBoard(state.game.settings, crypto.randomUUID())
    game.submissions = []
    game.roundScores = undefined
    game.missedWords = undefined
    game.roundStartedAt = now + BOGGLE_ROUND_COUNTDOWN_MS
    game.roundEndsAt = game.roundStartedAt + state.game.settings.roundSeconds * 1000
    state.status = 'active'
    await this.ctx.storage.setAlarm(game.roundEndsAt)
  }

  private async finalizeBoggleRound(state: RoomState, persist = true): Promise<void> {
    if (state.game.key !== 'boggle.v1') return
    const game = state.game.state
    const scores = scoreRound(game.submissions)
    for (const member of state.members) {
      if (!scores.some(score => score.memberId === member.id)) scores.push({ memberId: member.id, displayName: member.displayName, points: 0, words: [] })
    }
    scores.sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName))
    for (const score of scores) game.cumulativeScores[score.memberId] = (game.cumulativeScores[score.memberId] ?? 0) + score.points
    game.roundScores = scores
    game.missedWords = game.board ? findMissedWords(game.board, state.game.settings, game.submissions) : []
    state.status = 'round_results'
    if (persist) {
      state.sequence += 1
      this.writeState(state)
      this.broadcastSnapshots(state)
    }
  }

  private async finishMatch(state: RoomState): Promise<void> {
    state.status = 'finished'
    if (state.game.key === 'boggle.v1') state.game.state.roundEndsAt = undefined
    await this.ctx.storage.deleteAlarm()
  }

  private scoresFor(state: RoomState): Record<string, number> {
    return state.game.key === 'boggle.v1' ? state.game.state.cumulativeScores : state.game.state?.scores ?? {}
  }

  private finalPayload(state: RoomState): Record<string, unknown> {
    if (state.game.key === 'boggle.v1') return { rounds: state.game.state.currentRound }
    const game = state.game.state
    return {
      rulesVersion: state.game.settings.rulesVersion,
      targetScore: state.game.settings.targetScore,
      turns: game?.turnNumber ?? 0,
      farkles: Object.values(game?.stats ?? {}).reduce((total, stats) => total + stats.farkles, 0),
      highestBankedTurn: Math.max(0, ...Object.values(game?.stats ?? {}).map(stats => stats.highestBankedTurn))
    }
  }

  private async persistFinalization(state: RoomState): Promise<void> {
    const scores = this.scoresFor(state)
    const finalizedAt = new Date().toISOString()
    const ranked = [...state.members].sort((left, right) => (scores[right.id] ?? 0) - (scores[left.id] ?? 0) || left.displayName.localeCompare(right.displayName))
    const idempotencyKey = `match:${state.id}:final`
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO finalization_outbox (idempotency_key, payload_json) VALUES (?, ?)',
      idempotencyKey,
      JSON.stringify({ matchId: state.id, finalizedAt, ranked })
    )
    const participantNames = ranked.map(member => member.displayName)
    const summary = this.finalPayload(state)
    const statements: D1PreparedStatement[] = [
      this.env.DB.prepare(`UPDATE matches SET status = 'finished', ended_at = ?1 WHERE id = ?2`).bind(finalizedAt, state.id)
    ]
    let previousScore: number | undefined
    let rank = 0
    ranked.forEach((member, index) => {
      const score = scores[member.id] ?? 0
      if (score !== previousScore) rank = index + 1
      previousScore = score
      statements.push(
        this.env.DB.prepare(`
          INSERT INTO score_projections (idempotency_key, match_id, member_id, score, rank, payload_json, finalized_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          ON CONFLICT(match_id, member_id) DO UPDATE SET score = excluded.score, rank = excluded.rank,
            payload_json = excluded.payload_json, finalized_at = excluded.finalized_at
        `).bind(`${idempotencyKey}:${member.id}`, state.id, member.id, score, rank, JSON.stringify(summary), finalizedAt),
        this.env.DB.prepare(`
          INSERT INTO player_match_summaries (match_id, clerk_user_id, match_name, game_key, placement, score, participants_json, completed_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(match_id, clerk_user_id) DO UPDATE SET placement = excluded.placement, score = excluded.score,
            participants_json = excluded.participants_json, completed_at = excluded.completed_at
        `).bind(state.id, member.clerkUserId, state.name, state.game.key, rank, score, JSON.stringify(participantNames), finalizedAt)
      )
    })
    try {
      await this.env.DB.batch(statements)
      this.ctx.storage.sql.exec('UPDATE finalization_outbox SET delivered_at = ? WHERE idempotency_key = ?', Date.now(), idempotencyKey)
      await this.ctx.storage.deleteAlarm()
    } catch (error) {
      console.error(JSON.stringify({ message: 'match finalization delivery failed', matchId: state.id, error: String(error) }))
      await this.ctx.storage.setAlarm(Date.now() + 30_000)
    }
  }

  private readState(): RoomState | null {
    const row = this.ctx.storage.sql.exec<{ state_json: string }>('SELECT state_json FROM room_state WHERE singleton = 1').toArray()[0]
    if (!row) return null
    const parsed: unknown = JSON.parse(row.state_json)
    if (isVersionedRoomState(parsed)) return parsed
    if (isLegacyBoggleRoomState(parsed)) {
      const migrated = migrateLegacyState(parsed)
      this.writeState(migrated)
      return migrated
    }
    throw new Error('Stored room state has an unsupported shape')
  }

  private requireState(): RoomState {
    const state = this.readState()
    if (!state) throw new Error('Room is not initialized')
    return state
  }

  private readChatMessages(): ChatMessage[] {
    return this.ctx.storage.sql.exec<ChatMessageRow>(`
      SELECT id, member_id, display_name, message_text, sent_at FROM chat_messages ORDER BY id DESC LIMIT 100
    `).toArray().reverse().map(row => this.toChatMessage(row))
  }

  private toChatMessage(row: ChatMessageRow): ChatMessage {
    return { id: String(row.id), memberId: row.member_id, displayName: row.display_name, text: row.message_text, sentAt: row.sent_at }
  }

  private writeState(state: RoomState): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO room_state (singleton, state_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      JSON.stringify(state),
      Date.now()
    )
  }

  private isConnected(memberId: string): boolean {
    return this.ctx.getWebSockets(memberId).some(socket => socket.readyState === WebSocket.OPEN)
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
      gameKey: state.game.key,
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
        console.error(JSON.stringify({ message: 'websocket event broadcast failed', matchId: envelope.matchId, eventType: envelope.type, error: String(error) }))
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
