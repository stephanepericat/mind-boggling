import { currentScoringOptions, FARKLE_RULES } from '../../../shared/games/farkle'
import { getUnoCard, playableUnoCardIds, unoBlockingMemberId, UNO_RULES } from '../../../shared/games/uno'
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

  if (state.game.key === 'farkle.v1') {
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
        settings: { ...state.game.settings, diceColor: state.game.settings.diceColor ?? 'ivory' },
        view: {
          phase: game?.phase ?? 'opening-roll',
          turnOrder: game?.turnOrder ?? state.members.map(member => member.id),
          activeMemberId,
          turnNumber: game?.turnNumber ?? 0,
          scores: game?.scores ?? Object.fromEntries(state.members.map(member => [member.id, 0])),
          hasEnteredScoreboard: game?.hasEnteredScoreboard ?? {},
          turn: game?.turn,
          openingRollRounds: game?.openingRollRounds ?? [],
          openingWinnerMemberId: game?.openingWinnerMemberId,
          scoringOptions: game ? currentScoringOptions(game) : [],
          finalRound: game?.finalRound,
          suddenDeath: game?.suddenDeath,
          winnerMemberId: game?.winnerMemberId,
          lastHotDice: game?.lastHotDice,
          lastResolution: game?.lastResolution,
          canSkipActivePlayer: authorizedToSkip && skipEligibleAt !== undefined,
          skipEligibleAt: authorizedToSkip ? skipEligibleAt : undefined
        }
      }
    }
  }

  const game = state.game.state
  const blockingMemberId = game ? unoBlockingMemberId(game) : undefined
  const blockingMember = state.members.find(member => member.id === blockingMemberId)
  const viewer = state.members.find(member => member.id === viewerMemberId)
  const blockingPresence = blockingMemberId ? state.presence[blockingMemberId] : undefined
  const blockingDisconnected = Boolean(blockingMemberId && !connectedMemberIds.has(blockingMemberId))
  const disconnectResolveAt = blockingDisconnected && game && blockingPresence?.disconnectedAt
    ? Math.max(game.turn.startedAt, blockingPresence.disconnectedAt, blockingPresence.lastActivityAt) + UNO_RULES.disconnectGraceMs
    : undefined
  const authorizedToResolve = Boolean(
    viewer
    && blockingMember
    && viewer.id !== blockingMember.id
    && connectedMemberIds.has(viewer.id)
    && ((blockingMember.role === 'player' && viewer.role === 'host') || blockingMember.role === 'host')
  )
  const hand = game?.hands[viewerMemberId] ?? []

  return {
    ...base,
    gameKey: 'uno.v1',
    members: commonMembers(state, connectedMemberIds).map(member => ({
      ...member,
      cumulativeScore: game?.scores[member.id] ?? 0
    })),
    game: {
      key: 'uno.v1',
      settings: state.game.settings,
      view: {
        phase: game?.phase ?? 'playing',
        roundNumber: game?.roundNumber ?? 0,
        turnOrder: game?.turnOrder ?? state.members.map(member => member.id),
        dealerMemberId: game?.dealerMemberId ?? state.hostMemberId,
        dealerSelection: game?.dealerSelection ?? [],
        direction: game?.direction ?? 1,
        activeMemberId: game?.activeMemberId,
        activeColor: game?.activeColor,
        startingWildChooserMemberId: game?.startingWildChooserMemberId,
        topCard: game?.discardPile.at(-1) ? getUnoCard(game.discardPile.at(-1)!) : undefined,
        drawPileCount: game?.drawPile.length ?? 0,
        hand: hand.map(getUnoCard),
        opponents: state.members.filter(member => member.id !== viewerMemberId).map(member => ({
          memberId: member.id,
          cardCount: game?.hands[member.id]?.length ?? 0
        })),
        scores: game?.scores ?? Object.fromEntries(state.members.map(member => [member.id, 0])),
        playableCardIds: game ? playableUnoCardIds(game, viewerMemberId) : [],
        canDraw: Boolean(game && game.phase === 'playing' && game.activeMemberId === viewerMemberId && !game.startingWildChooserMemberId && !game.pendingWildDrawFour && !game.turn.drawnCardId),
        canPass: Boolean(game && game.phase === 'playing' && game.activeMemberId === viewerMemberId && game.turn.drawnCardId),
        canChooseStartingColor: game?.startingWildChooserMemberId === viewerMemberId,
        canCallUno: game?.pendingUno?.memberId === viewerMemberId,
        canCatchUno: Boolean(game?.pendingUno && game.pendingUno.memberId !== viewerMemberId),
        vulnerableMemberId: game?.pendingUno?.memberId,
        pendingWildDrawFour: game?.pendingWildDrawFour
          ? {
              playedByMemberId: game.pendingWildDrawFour.playedByMemberId,
              affectedMemberId: game.pendingWildDrawFour.affectedMemberId,
              chosenColor: game.pendingWildDrawFour.chosenColor,
              canRespond: game.pendingWildDrawFour.affectedMemberId === viewerMemberId
            }
          : undefined,
        drawnCardId: game?.activeMemberId === viewerMemberId ? game.turn.drawnCardId : undefined,
        roundResult: game?.roundResult,
        winnerMemberId: game?.winnerMemberId,
        lastAction: game?.lastAction,
        canResolveDisconnectedPlayer: authorizedToResolve && disconnectResolveAt !== undefined,
        disconnectResolveAt: authorizedToResolve ? disconnectResolveAt : undefined
      }
    }
  }
}
