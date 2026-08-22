import type { DiceRoll } from '../../dice/types'
import { FARKLE_RULES } from './rules'
import { enumerateScoringOptions, hasScoringOption, scoreSelection } from './scoring'
import type { FarkleOpeningRollRound, FarkleSettings, FarkleState } from './types'

export interface FarkleTransitionResult {
  state: FarkleState
  error?: string
}

function clone(state: FarkleState): FarkleState {
  return structuredClone(state)
}

function startTurn(state: FarkleState, memberId: string, now: number): void {
  state.activeTurnIndex = state.turnOrder.indexOf(memberId)
  state.turnNumber += 1
  state.stats[memberId]!.turns += 1
  state.turn = {
    memberId,
    startedAt: now,
    unbankedScore: 0,
    availableDieIds: [...FARKLE_RULES_DIE_IDS],
    committedSelections: []
  }
}

const FARKLE_RULES_DIE_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const

function leaders(state: FarkleState, eligible = state.turnOrder): string[] {
  const highScore = Math.max(...eligible.map(memberId => state.scores[memberId] ?? 0))
  return eligible.filter(memberId => (state.scores[memberId] ?? 0) === highScore)
}

function finishOrStartSuddenDeath(state: FarkleState, now: number, eligible = state.turnOrder): void {
  const tied = leaders(state, eligible)
  if (tied.length === 1) {
    state.phase = 'finished'
    state.winnerMemberId = tied[0]
    state.turn = undefined
    state.finalRound = undefined
    state.suddenDeath = undefined
    return
  }
  const ordered = state.turnOrder.filter(memberId => tied.includes(memberId))
  state.phase = 'sudden-death'
  const cycle = (state.suddenDeath?.cycle ?? 0) + 1
  const [first, ...remaining] = ordered
  state.suddenDeath = { cycle, eligibleMemberIds: ordered, remainingMemberIds: remaining }
  startTurn(state, first!, now)
}

function advanceAfterTurn(state: FarkleState, now: number): void {
  if (state.phase === 'final-turns') {
    const next = state.finalRound?.remainingMemberIds.shift()
    if (next) startTurn(state, next, now)
    else finishOrStartSuddenDeath(state, now)
    return
  }
  if (state.phase === 'sudden-death') {
    const next = state.suddenDeath?.remainingMemberIds.shift()
    if (next) startTurn(state, next, now)
    else finishOrStartSuddenDeath(state, now, state.suddenDeath?.eligibleMemberIds ?? state.turnOrder)
    return
  }
  const nextIndex = (state.activeTurnIndex + 1) % state.turnOrder.length
  startTurn(state, state.turnOrder[nextIndex]!, now)
}

export function createFarkleState(
  memberIds: readonly string[],
  openingRollRounds: readonly FarkleOpeningRollRound[],
  now: number
): FarkleState {
  if (memberIds.length < 2 || memberIds.length > 8) throw new Error('Farkle requires 2–8 players')
  const finalRound = openingRollRounds.at(-1)
  const starter = finalRound?.tiedLeaderMemberIds.length === 1 ? finalRound.tiedLeaderMemberIds[0] : undefined
  if (!starter || !memberIds.includes(starter)) throw new Error('Opening rolls must resolve to one starting player')
  const starterIndex = memberIds.indexOf(starter)
  const turnOrder = [...memberIds.slice(starterIndex), ...memberIds.slice(0, starterIndex)]
  const state: FarkleState = {
    rulesVersion: 'classic.v1',
    phase: 'playing',
    turnOrder,
    activeTurnIndex: 0,
    turnNumber: 0,
    scores: Object.fromEntries(memberIds.map(memberId => [memberId, 0])),
    hasEnteredScoreboard: Object.fromEntries(memberIds.map(memberId => [memberId, false])),
    openingRollRounds: [...openingRollRounds],
    stats: Object.fromEntries(memberIds.map(memberId => [memberId, { turns: 0, farkles: 0, highestBankedTurn: 0 }]))
  }
  startTurn(state, starter, now)
  return state
}

export function resolveOpeningRolls(
  memberIds: readonly string[],
  rollValue: (memberId: string, round: number) => number,
  createRollId: () => string
): FarkleOpeningRollRound[] {
  let contenders = [...memberIds]
  const rounds: FarkleOpeningRollRound[] = []
  while (contenders.length > 1) {
    const valuesByMemberId = Object.fromEntries(contenders.map(memberId => [memberId, rollValue(memberId, rounds.length)]))
    const high = Math.max(...Object.values(valuesByMemberId))
    contenders = contenders.filter(memberId => valuesByMemberId[memberId] === high)
    rounds.push({ rollId: createRollId(), valuesByMemberId, tiedLeaderMemberIds: [...contenders] })
  }
  return rounds
}

function applyResolvedRoll(state: FarkleState, roll: DiceRoll<number>, now: number): void {
  state.turn!.currentRoll = roll
  if (hasScoringOption(roll.dice)) return
  const memberId = state.turn!.memberId
  state.stats[memberId]!.farkles += 1
  state.lastResolution = { type: 'farkled', memberId, points: 0, at: now }
  advanceAfterTurn(state, now)
}

export function rollFarkleDice(state: FarkleState, actorMemberId: string, roll: DiceRoll<number>, now: number): FarkleTransitionResult {
  const next = clone(state)
  if (!next.turn || next.turn.memberId !== actorMemberId) return { state, error: 'not_your_turn' }
  if (next.phase === 'finished' || next.turn.currentRoll) return { state, error: 'invalid_state' }
  if (roll.dice.map(die => die.id).join(',') !== next.turn.availableDieIds.join(',')) return { state, error: 'invalid_roll' }
  applyResolvedRoll(next, roll, now)
  return { state: next }
}

function validateSelection(state: FarkleState, actorMemberId: string, rollId: string, selectedDieIds: readonly string[]) {
  if (!state.turn || state.turn.memberId !== actorMemberId) return { error: 'not_your_turn' as const }
  const roll = state.turn.currentRoll
  if (!roll || roll.id !== rollId) return { error: 'stale_roll' as const }
  if (new Set(selectedDieIds).size !== selectedDieIds.length) return { error: 'invalid_selection' as const }
  const selected = roll.dice.filter(die => selectedDieIds.includes(die.id))
  if (selected.length !== selectedDieIds.length) return { error: 'invalid_selection' as const }
  const score = scoreSelection(selected)
  if (!score) return { error: 'selection_does_not_score' as const }
  return { roll, score }
}

export function continueFarkleTurn(
  state: FarkleState,
  actorMemberId: string,
  rollId: string,
  selectedDieIds: readonly string[],
  nextRoll: DiceRoll<number>,
  now: number
): FarkleTransitionResult {
  const next = clone(state)
  const validation = validateSelection(next, actorMemberId, rollId, selectedDieIds)
  if ('error' in validation) return { state, error: validation.error }
  next.turn!.unbankedScore += validation.score.score
  next.turn!.committedSelections.push({ rollId, dieIds: [...selectedDieIds], score: validation.score.score, breakdown: validation.score.breakdown })
  const remaining = validation.roll.dice.filter(die => !selectedDieIds.includes(die.id)).map(die => die.id)
  next.turn!.availableDieIds = remaining.length === 0 ? [...FARKLE_RULES_DIE_IDS] : remaining
  next.turn!.currentRoll = undefined
  if (nextRoll.dice.map(die => die.id).join(',') !== next.turn!.availableDieIds.join(',')) return { state, error: 'invalid_roll' }
  applyResolvedRoll(next, nextRoll, now)
  return { state: next }
}

export function bankFarkleTurn(
  state: FarkleState,
  settings: FarkleSettings,
  actorMemberId: string,
  rollId: string,
  selectedDieIds: readonly string[],
  now: number
): FarkleTransitionResult {
  const next = clone(state)
  const validation = validateSelection(next, actorMemberId, rollId, selectedDieIds)
  if ('error' in validation) return { state, error: validation.error }
  const banked = next.turn!.unbankedScore + validation.score.score
  if (!next.hasEnteredScoreboard[actorMemberId] && banked < FARKLE_RULES.openingThreshold) {
    return { state, error: 'opening_threshold_not_met' }
  }
  next.scores[actorMemberId] = (next.scores[actorMemberId] ?? 0) + banked
  next.hasEnteredScoreboard[actorMemberId] = true
  next.stats[actorMemberId]!.highestBankedTurn = Math.max(next.stats[actorMemberId]!.highestBankedTurn, banked)
  next.lastResolution = { type: 'banked', memberId: actorMemberId, points: banked, at: now }

  if (next.phase === 'playing' && next.scores[actorMemberId]! >= settings.targetScore) {
    next.phase = 'final-turns'
    const index = next.turnOrder.indexOf(actorMemberId)
    const remainingMemberIds = [...next.turnOrder.slice(index + 1), ...next.turnOrder.slice(0, index)]
    next.finalRound = { triggeredByMemberId: actorMemberId, remainingMemberIds }
  }
  advanceAfterTurn(next, now)
  return { state: next }
}

export function skipFarkleTurn(state: FarkleState, targetMemberId: string, now: number): FarkleTransitionResult {
  const next = clone(state)
  if (!next.turn || next.turn.memberId !== targetMemberId || next.phase === 'finished') return { state, error: 'invalid_state' }
  next.lastResolution = { type: 'skipped', memberId: targetMemberId, points: 0, at: now }
  advanceAfterTurn(next, now)
  return { state: next }
}

export function currentScoringOptions(state: FarkleState) {
  return state.turn?.currentRoll ? enumerateScoringOptions(state.turn.currentRoll.dice) : []
}
