import type { BoggleBoard, BoggleSettings, MemberRoundScore, WordSubmission } from '../../../shared/games/boggle'
import type { FarkleSettings, FarkleState } from '../../../shared/games/farkle'
import type { ChatMessage } from '../../../shared/platform/chat'
import type { MatchStatus, MatchView } from '../../../shared/types/api'

export interface RoomMember {
  id: string
  clerkUserId: string
  displayName: string
  role: 'host' | 'player'
  ready: boolean
}

export interface MemberPresence {
  lastActivityAt: number
  disconnectedAt?: number
}

export interface BoggleRoomGameState {
  key: 'boggle.v1'
  settings: BoggleSettings
  state: {
    currentRound: number
    board?: BoggleBoard
    roundStartedAt?: number
    roundEndsAt?: number
    submissions: WordSubmission[]
    roundScores?: MemberRoundScore[]
    missedWords?: string[]
    cumulativeScores: Record<string, number>
  }
}

export interface FarkleRoomGameState {
  key: 'farkle.v1'
  settings: FarkleSettings
  state: FarkleState | null
}

export interface RoomState {
  stateVersion: 2
  id: string
  name: string
  status: MatchStatus
  hostMemberId: string
  members: RoomMember[]
  sequence: number
  presence: Record<string, MemberPresence>
  game: BoggleRoomGameState | FarkleRoomGameState
}

export interface InitializeRoomInput {
  state: {
    id: string
    name: string
    gameKey: 'boggle.v1' | 'farkle.v1'
    settings: BoggleSettings | FarkleSettings
    hostMemberId: string
    members: RoomMember[]
  }
}

export interface ConnectionAttachment {
  memberId: string
  connectedAt: number
}

export interface RoomSnapshotResponse {
  state: MatchView
  serverTime: number
  chatMessages: ChatMessage[]
}
