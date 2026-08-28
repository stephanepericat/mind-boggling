import type { DiceRoll, RolledDie } from '../../dice/types'

export const FARKLE_DIE_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const
export type FarkleDieId = typeof FARKLE_DIE_IDS[number]

export const FARKLE_DICE_COLORS = ['ivory', 'blue', 'orange', 'red', 'green', 'purple', 'black', 'turquoise'] as const
export type FarkleDiceColor = typeof FARKLE_DICE_COLORS[number]
export type FarkleDiceColorSetting = FarkleDiceColor | 'random'

export interface FarkleSettings {
  rulesVersion: 'classic.v1'
  targetScore: 1000 | 5000 | 10000
  diceColor: FarkleDiceColorSetting
  locale: 'en-US'
}

export interface FarkleScoreBreakdown {
  label: string
  score: number
  dieIds: string[]
}

export interface FarkleSelection {
  rollId: string
  dieIds: string[]
  score: number
  breakdown: FarkleScoreBreakdown[]
}

export interface FarkleOpeningRollRound {
  rollId: string
  valuesByMemberId: Record<string, number>
  tiedLeaderMemberIds: string[]
}

export interface FarkleTurn {
  memberId: string
  startedAt: number
  unbankedScore: number
  availableDieIds: string[]
  currentRoll?: DiceRoll<number>
  committedSelections: FarkleSelection[]
}

export interface FarklePlayerStats {
  turns: number
  farkles: number
  highestBankedTurn: number
}

export interface FarkleState {
  rulesVersion: 'classic.v1'
  phase: 'opening-roll' | 'playing' | 'final-turns' | 'sudden-death' | 'finished'
  turnOrder: string[]
  activeTurnIndex: number
  turnNumber: number
  scores: Record<string, number>
  hasEnteredScoreboard: Record<string, boolean>
  turn?: FarkleTurn
  openingRollRounds: FarkleOpeningRollRound[]
  openingWinnerMemberId?: string
  finalRound?: {
    triggeredByMemberId: string
    remainingMemberIds: string[]
  }
  suddenDeath?: {
    cycle: number
    eligibleMemberIds: string[]
    remainingMemberIds: string[]
  }
  winnerMemberId?: string
  lastHotDice?: {
    memberId: string
    sourceRollId: string
    nextRollId: string
    points: number
    at: number
  }
  lastResolution?:
    | { type: 'banked' | 'skipped', memberId: string, points: number, at: number }
    | { type: 'farkled', memberId: string, points: 0, at: number, rollId?: string, dice: NumericRolledDie[] }
  stats: Record<string, FarklePlayerStats>
}

export interface FarkleScoringOption {
  dieIds: string[]
  score: number
  breakdown: FarkleScoreBreakdown[]
}

export interface FarklePlayerView {
  phase: FarkleState['phase']
  turnOrder: string[]
  activeMemberId?: string
  turnNumber: number
  scores: Record<string, number>
  hasEnteredScoreboard: Record<string, boolean>
  turn?: FarkleTurn
  openingRollRounds: FarkleOpeningRollRound[]
  openingWinnerMemberId?: string
  scoringOptions: FarkleScoringOption[]
  finalRound?: FarkleState['finalRound']
  suddenDeath?: FarkleState['suddenDeath']
  winnerMemberId?: string
  lastHotDice?: FarkleState['lastHotDice']
  lastResolution?: FarkleState['lastResolution']
  canSkipActivePlayer: boolean
  skipEligibleAt?: number
}

export type NumericRolledDie = RolledDie<number>
