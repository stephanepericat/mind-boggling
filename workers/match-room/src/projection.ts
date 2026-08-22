import { currentScoringOptions, FARKLE_RULES } from '../../../shared/games/farkle'
import type { MatchMemberView, MatchView } from '../../../shared/types/api'
import type { RoomState } from './types'

function commonMembers(state: RoomState, connectedMemberIds: ReadonlySet<string>): MatchMemberView[] {
  return state.members.map(member => ({
    id: member.id,
    displayName: member.displayName,
    role: member.role,
    ready: member.ready,
    connected: connectedMemberIds.has(member.id)
  }))
}

export function projectRoomState(
  state: RoomState,
  viewerMemberId: string,
  connectedMemberIds: ReadonlySet<string>
): MatchView {
  const base = {
    id: state.id,
    name: state.name,
    gameKey: state.game.key,
    status: state.status,
    hostMemberId: state.hostMemberId,
    sequence: state.sequence,
    viewerMemberId
  }

  if (state.game.key === 'boggle.v1') {
    const game = state.game.state
    const active = state.status === 'active'
    return {
      ...base,
      gameKey: 'boggle.v1',
      members: commonMembers(state, connectedMemberIds).map(member => ({
        ...member,
        wordCount: game.submissions.filter(item => item.memberId === member.id).length,
        cumulativeScore: active ? undefined : game.cumulativeScores[member.id] ?? 0
      })),
      game: {
        key: 'boggle.v1',
        settings: state.game.settings,
        view: {
          currentRound: game.currentRound,
          board: game.board,
          roundStartedAt: game.roundStartedAt,
          roundEndsAt: game.roundEndsAt,
          roundScores: active ? undefined : game.roundScores,
          missedWords: active ? undefined : game.missedWords,
          submittedWords: active
            ? game.submissions.filter(item => item.memberId === viewerMemberId).map(item => item.word)
            : undefined
        }
      }
    }
  }

  const game = state.game.state
  const activeMemberId = game?.turn?.memberId
  const activePresence = activeMemberId ? state.presence[activeMemberId] : undefined
  const activeDisconnected = Boolean(activeMemberId && !connectedMemberIds.has(activeMemberId))
  const skipEligibleAt = activeDisconnected && game?.turn && activePresence?.disconnectedAt
    ? Math.max(game.turn.startedAt, activePresence.disconnectedAt, activePresence.lastActivityAt) + FARKLE_RULES.disconnectGraceMs
    : undefined
  const viewer = state.members.find(member => member.id === viewerMemberId)
  const active = state.members.find(member => member.id === activeMemberId)
  const authorizedToSkip = Boolean(
    viewer
    && active
    && viewer.id !== active.id
    && connectedMemberIds.has(viewer.id)
    && ((active.role === 'player' && viewer.role === 'host') || active.role === 'host')
  )

  return {
    ...base,
    gameKey: 'farkle.v1',
    members: commonMembers(state, connectedMemberIds).map(member => ({
      ...member,
      cumulativeScore: game?.scores[member.id] ?? 0
    })),
    game: {
      key: 'farkle.v1',
      settings: state.game.settings,
      view: {
        phase: game?.phase ?? 'opening-roll',
        turnOrder: game?.turnOrder ?? state.members.map(member => member.id),
        activeMemberId,
        turnNumber: game?.turnNumber ?? 0,
        scores: game?.scores ?? Object.fromEntries(state.members.map(member => [member.id, 0])),
        hasEnteredScoreboard: game?.hasEnteredScoreboard ?? {},
        turn: game?.turn,
        openingRollRounds: game?.openingRollRounds ?? [],
        scoringOptions: game ? currentScoringOptions(game) : [],
        finalRound: game?.finalRound,
        suddenDeath: game?.suddenDeath,
        winnerMemberId: game?.winnerMemberId,
        lastResolution: game?.lastResolution,
        canSkipActivePlayer: authorizedToSkip && skipEligibleAt !== undefined,
        skipEligibleAt: authorizedToSkip ? skipEligibleAt : undefined
      }
    }
  }
}
