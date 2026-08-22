import type { BoggleBoard, BoggleSettings, MemberRoundScore } from '../games/boggle'
import type { FarklePlayerView, FarkleSettings } from '../games/farkle'
import type { GameKey } from '../games/contract'

export type MatchStatus = 'lobby' | 'active' | 'round_results' | 'finished' | 'cancelled'

export interface MatchMemberView {
  id: string
  displayName: string
  role: 'host' | 'player'
  ready: boolean
  connected: boolean
  wordCount?: number
  cumulativeScore?: number
}

interface PlatformMatchView {
  id: string
  name: string
  status: MatchStatus
  hostMemberId: string
  inviteUrl?: string
  members: MatchMemberView[]
  sequence: number
  viewerMemberId: string
}

export interface BogglePlayerView {
  currentRound: number
  board?: BoggleBoard
  roundStartedAt?: number
  roundEndsAt?: number
  roundScores?: MemberRoundScore[]
  missedWords?: string[]
  submittedWords?: string[]
}

export interface BoggleMatchView extends PlatformMatchView {
  gameKey: 'boggle.v1'
  game: { key: 'boggle.v1', settings: BoggleSettings, view: BogglePlayerView }
}

export interface FarkleMatchView extends PlatformMatchView {
  gameKey: 'farkle.v1'
  game: { key: 'farkle.v1', settings: FarkleSettings, view: FarklePlayerView }
}

export type MatchView = BoggleMatchView | FarkleMatchView

export interface MatchHistoryItem {
  matchId: string
  matchName: string
  gameName: string
  completedAt: string
  placement: number
  score: number
  participants: string[]
}

export interface LeaderboardGameOption {
  key: GameKey
  name: string
}

export interface AllTimeBestEntry {
  rank: number
  matchId: string
  matchName: string
  playerId: string
  playerName: string
  score: number
  achievedAt: string
}

export interface AllTimeBestResponse {
  games: LeaderboardGameOption[]
  selectedGameKey: GameKey
  entries: AllTimeBestEntry[]
}

export interface RealtimeEnvelope<T = unknown> {
  version: 1
  matchId: string
  gameKey: string
  sequence: number
  occurredAt: string
  type: string
  payload: T
}
