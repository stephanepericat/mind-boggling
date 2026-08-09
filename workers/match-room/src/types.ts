import type { BoggleBoard, BoggleSettings, MemberRoundScore, WordSubmission } from '../../../shared/games/boggle'
import type { MatchStatus, MatchView } from '../../../shared/types/api'

export interface RoomMember {
  id: string
  clerkUserId: string
  displayName: string
  role: 'host' | 'player'
  ready: boolean
}

export interface RoomState {
  id: string
  name: string
  gameKey: 'boggle.v1'
  status: MatchStatus
  settings: BoggleSettings
  hostMemberId: string
  currentRound: number
  board?: BoggleBoard
  roundStartedAt?: number
  roundEndsAt?: number
  members: RoomMember[]
  submissions: WordSubmission[]
  roundScores?: MemberRoundScore[]
  cumulativeScores: Record<string, number>
  sequence: number
}

export interface InitializeRoomInput {
  state: Pick<RoomState, 'id' | 'name' | 'gameKey' | 'settings' | 'hostMemberId' | 'members'>
}

export interface ConnectionAttachment {
  memberId: string
  connectedAt: number
}

export interface RoomSnapshotResponse {
  state: MatchView
  serverTime: number
}
