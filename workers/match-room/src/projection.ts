import type { MatchView } from '../../../shared/types/api'
import type { RoomState } from './types'

export function projectRoomState(state: RoomState, viewerMemberId: string, connectedMemberIds: ReadonlySet<string>): MatchView {
  const active = state.status === 'active'
  return {
    id: state.id,
    name: state.name,
    gameKey: state.gameKey,
    status: state.status,
    settings: state.settings,
    hostMemberId: state.hostMemberId,
    currentRound: state.currentRound,
    board: state.board,
    roundStartedAt: state.roundStartedAt,
    roundEndsAt: state.roundEndsAt,
    members: state.members.map(member => ({
      id: member.id,
      displayName: member.displayName,
      role: member.role,
      ready: member.ready,
      connected: connectedMemberIds.has(member.id),
      wordCount: state.submissions.filter(item => item.memberId === member.id).length,
      cumulativeScore: active ? undefined : state.cumulativeScores[member.id] ?? 0
    })),
    roundScores: active ? undefined : state.roundScores,
    submittedWords: active
      ? state.submissions.filter(item => item.memberId === viewerMemberId).map(item => item.word)
      : undefined,
    sequence: state.sequence,
    viewerMemberId
  }
}
