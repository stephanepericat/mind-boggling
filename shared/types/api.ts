import type { BoggleBoard, BoggleSettings, MemberRoundScore } from '../games/boggle'
import type { GameKey } from '../games/contract'

export type MatchStatus = 'lobby' | 'active' | 'round_results' | 'finished' | 'cancelled'

export interface MatchMemberView {
  id: string
  displayName: string
  role: 'host' | 'player'
  ready: boolean
  connected: boolean
  wordCount: number
  cumulativeScore?: number
}

export interface MatchView {
  id: string
  name: string
  gameKey: 'boggle.v1'
  status: MatchStatus
  settings: BoggleSettings
  hostMemberId: string
  inviteUrl?: string
  currentRound: number
  board?: BoggleBoard
  roundStartedAt?: number
  roundEndsAt?: number
  members: MatchMemberView[]
  roundScores?: MemberRoundScore[]
  missedWords?: string[]
  submittedWords?: string[]
  sequence: number
  viewerMemberId: string
}

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
