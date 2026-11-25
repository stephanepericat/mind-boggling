import type { BoggleBoard, BoggleSettings, MemberRoundScore, WordSubmission } from '../../../shared/games/boggle'
import type { FarkleSettings, FarkleState } from '../../../shared/games/farkle'
import type { HoldemSettings, HoldemState } from '../../../shared/games/texas-holdem'
import type { UnoSettings, UnoState } from '../../../shared/games/uno'
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
  lastHttpActivityAt?: number
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

export interface UnoRoomGameState {
  key: 'uno.v1'
  settings: UnoSettings
  state: UnoState | null
}

export interface HoldemRoomGameState {
  key: 'texas-holdem.v1'
  settings: HoldemSettings
  state: HoldemState | null
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
  game: BoggleRoomGameState | FarkleRoomGameState | UnoRoomGameState | HoldemRoomGameState
}

export interface InitializeRoomInput {
  state: {
    id: string
    name: string
    gameKey: RoomState['game']['key']
    settings: RoomState['game']['settings']
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
