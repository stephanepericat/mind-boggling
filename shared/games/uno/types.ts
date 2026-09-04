import type { UNO_COLORS, UNO_TARGET_SCORES } from './rules'

export type UnoColor = typeof UNO_COLORS[number]
export type UnoTargetScore = typeof UNO_TARGET_SCORES[number]
export type UnoDirection = 1 | -1
export type UnoCardKind = 'number' | 'skip' | 'reverse' | 'draw-two' | 'wild' | 'wild-draw-four'

export interface UnoCard {
  id: string
  kind: UnoCardKind
  color?: UnoColor
  number?: number
}

export interface UnoSettings {
  rulesVersion: 'classic-108.v1'
  targetScore: UnoTargetScore
  locale: 'en-US'
}

export interface UnoDealerDraw {
  memberId: string
  card: UnoCard
}

export interface UnoDealerRound {
  draws: UnoDealerDraw[]
  tiedLeaderMemberIds: string[]
}

export interface UnoRoundHandResult {
  memberId: string
  cards: UnoCard[]
  points: number
}

export interface UnoRoundResult {
  roundNumber: number
  winnerMemberId: string
  points: number
  hands: UnoRoundHandResult[]
  scores: Record<string, number>
}

export type UnoLastAction
  = | { type: 'played', memberId: string, card: UnoCard, chosenColor?: UnoColor, calledUno: boolean, at: number }
    | { type: 'drew', memberId: string, count: number, at: number }
    | { type: 'color-chosen', memberId: string, color: UnoColor, at: number }
    | { type: 'uno-called', memberId: string, at: number }
    | { type: 'uno-caught', memberId: string, caughtByMemberId: string, at: number }
    | { type: 'challenge', playedByMemberId: string, challengedByMemberId: string, verdict: 'legal' | 'illegal', cardsDrawn: number, at: number }
    | { type: 'disconnect-resolved', memberId: string, at: number }

export interface UnoPendingWildDrawFour {
  playedByMemberId: string
  affectedMemberId: string
  chosenColor: UnoColor
  wasLegal: boolean
  apparentWinnerMemberId?: string
}

export interface UnoStats {
  cardsPlayed: number
  cardsDrawn: number
  challenges: number
}

export interface UnoState {
  rulesVersion: 'classic-108.v1'
  phase: 'playing' | 'round-results' | 'finished'
  roundNumber: number
  turnOrder: string[]
  dealerMemberId: string
  dealerSelection: UnoDealerRound[]
  direction: UnoDirection
  activeMemberId?: string
  activeColor?: UnoColor
  startingWildChooserMemberId?: string
  drawPile: string[]
  discardPile: string[]
  hands: Record<string, string[]>
  scores: Record<string, number>
  turn: { startedAt: number, drawnCardId?: string }
  pendingUno?: { memberId: string }
  pendingWildDrawFour?: UnoPendingWildDrawFour
  roundResult?: UnoRoundResult
  winnerMemberId?: string
  lastAction?: UnoLastAction
  stats: UnoStats
}

export interface UnoOpponentView {
  memberId: string
  cardCount: number
}

export interface UnoPendingWildDrawFourView {
  playedByMemberId: string
  affectedMemberId: string
  chosenColor: UnoColor
  canRespond: boolean
}

export interface UnoPlayerView {
  phase: UnoState['phase']
  roundNumber: number
  turnOrder: string[]
  dealerMemberId: string
  dealerSelection: UnoDealerRound[]
  direction: UnoDirection
  activeMemberId?: string
  activeColor?: UnoColor
  startingWildChooserMemberId?: string
  topCard?: UnoCard
  drawPileCount: number
  hand: UnoCard[]
  opponents: UnoOpponentView[]
  scores: Record<string, number>
  playableCardIds: string[]
  canDraw: boolean
  canPass: boolean
  canChooseStartingColor: boolean
  canCallUno: boolean
  canCatchUno: boolean
  vulnerableMemberId?: string
  pendingWildDrawFour?: UnoPendingWildDrawFourView
  drawnCardId?: string
  roundResult?: UnoRoundResult
  winnerMemberId?: string
  lastAction?: UnoLastAction
  canResolveDisconnectedPlayer: boolean
  disconnectResolveAt?: number
}

export interface UnoTransitionResult {
  state: UnoState
  error?: string
}

export type UnoShuffle = (cardIds: readonly string[]) => string[]
