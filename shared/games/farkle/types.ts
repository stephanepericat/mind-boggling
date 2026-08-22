import type { DiceRoll, RolledDie } from '../../dice/types'

export const FARKLE_DIE_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const
export type FarkleDieId = typeof FARKLE_DIE_IDS[number]

export interface FarkleSettings {
  rulesVersion: 'classic.v1'
  targetScore: 1000 | 5000 | 10000
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
  lastResolution?: {
    type: 'banked' | 'farkled' | 'skipped'
    memberId: string
    points: number
    at: number
  }
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
  scoringOptions: FarkleScoringOption[]
  finalRound?: FarkleState['finalRound']
  suddenDeath?: FarkleState['suddenDeath']
  winnerMemberId?: string
  lastResolution?: FarkleState['lastResolution']
  canSkipActivePlayer: boolean
  skipEligibleAt?: number
}

export type NumericRolledDie = RolledDie<number>
