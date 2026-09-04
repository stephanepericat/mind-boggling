import { getUnoCard, isUnoCardPlayable, isWildDrawFourLegal, unoCardPoints, unoDealerCardValue } from './deck'
import { UNO_COLORS, UNO_RULES } from './rules'
import type {
  UnoCard,
  UnoColor,
  UnoDealerRound,
  UnoSettings,
  UnoShuffle,
  UnoState,
  UnoTransitionResult
} from './types'

function clone(state: UnoState): UnoState {
  return structuredClone(state)
}

function nextMember(state: Pick<UnoState, 'turnOrder' | 'direction'>, memberId: string, steps = 1): string {
  const index = state.turnOrder.indexOf(memberId)
  if (index < 0) throw new Error('UNO member is not seated')
  const length = state.turnOrder.length
  return state.turnOrder[((index + state.direction * steps) % length + length) % length]!
}

function clockwiseMember(turnOrder: readonly string[], memberId: string): string {
  const index = turnOrder.indexOf(memberId)
  if (index < 0) throw new Error('UNO member is not seated')
  return turnOrder[(index + 1) % turnOrder.length]!
}

function validateShuffledCards(expected: readonly string[], shuffled: readonly string[]): void {
  if (expected.length !== shuffled.length) throw new Error('UNO reshuffle returned the wrong number of cards')
  const expectedIds = [...expected].sort()
  const actualIds = [...shuffled].sort()
  if (expectedIds.some((id, index) => id !== actualIds[index])) throw new Error('UNO reshuffle returned different cards')
}

function drawCards(state: UnoState, memberId: string, count: number, shuffleDiscard: UnoShuffle): string[] {
  const hand = state.hands[memberId]
  if (!hand) throw new Error('UNO hand is missing')
  const drawn: string[] = []
  while (drawn.length < count) {
    if (state.drawPile.length === 0) {
      const topCardId = state.discardPile.at(-1)
      const recyclable = state.discardPile.slice(0, -1)
      if (!topCardId || recyclable.length === 0) break
      const shuffled = shuffleDiscard(recyclable)
      validateShuffledCards(recyclable, shuffled)
      state.discardPile = [topCardId]
      state.drawPile = [...shuffled]
    }
    const cardId = state.drawPile.pop()
    if (!cardId) break
    hand.push(cardId)
    drawn.push(cardId)
  }
  state.stats.cardsDrawn += drawn.length
  return drawn
}

function closeUnoWindow(state: UnoState): void {
  state.pendingUno = undefined
}

function strongestHandColor(state: UnoState, memberId: string): UnoColor {
  const counts = Object.fromEntries(UNO_COLORS.map(color => [color, 0])) as Record<UnoColor, number>
  for (const cardId of state.hands[memberId] ?? []) {
    const color = getUnoCard(cardId).color
    if (color) counts[color] += 1
  }
  return UNO_COLORS.reduce((strongest, color) => counts[color] > counts[strongest] ? color : strongest)
}

function startNextTurn(state: UnoState, fromMemberId: string, now: number, steps = 1): void {
  state.activeMemberId = nextMember(state, fromMemberId, steps)
  state.turn = { startedAt: now }
}

function publicHands(state: UnoState) {
  return state.turnOrder.map((memberId) => {
    const cards = (state.hands[memberId] ?? []).map(getUnoCard)
    return { memberId, cards, points: cards.reduce((total, card) => total + unoCardPoints(card), 0) }
  })
}

function finishRound(state: UnoState, settings: UnoSettings, winnerMemberId: string): void {
  const hands = publicHands(state)
  const points = hands.filter(hand => hand.memberId !== winnerMemberId).reduce((total, hand) => total + hand.points, 0)
  state.scores[winnerMemberId] = (state.scores[winnerMemberId] ?? 0) + points
  state.roundResult = {
    roundNumber: state.roundNumber,
    winnerMemberId,
    points,
    hands,
    scores: { ...state.scores }
  }
  state.pendingUno = undefined
  state.pendingWildDrawFour = undefined
  state.startingWildChooserMemberId = undefined
  state.activeMemberId = undefined
  state.turn = { startedAt: state.turn.startedAt }
  if (state.scores[winnerMemberId]! >= settings.targetScore) {
    state.phase = 'finished'
    state.winnerMemberId = winnerMemberId
  } else {
    state.phase = 'round-results'
  }
}

function dealRound(
  memberIds: readonly string[],
  dealerMemberId: string,
  deckOrder: readonly UnoCard[],
  scores: Record<string, number>,
  roundNumber: number,
  dealerSelection: UnoDealerRound[],
  shuffleDiscard: UnoShuffle,
  stats: UnoState['stats'],
  now: number
): UnoState {
  if (memberIds.length < 2 || memberIds.length > 8) throw new Error('UNO requires 2–8 players')
  if (new Set(memberIds).size !== memberIds.length || !memberIds.includes(dealerMemberId)) throw new Error('UNO seating is invalid')
  if (deckOrder.length !== UNO_RULES.deckSize || new Set(deckOrder.map(card => card.id)).size !== UNO_RULES.deckSize) {
    throw new Error('UNO requires one complete 108-card deck')
  }
  const drawPile = deckOrder.map(card => card.id)
  const hands = Object.fromEntries(memberIds.map(memberId => [memberId, [] as string[]]))
  const firstToReceive = memberIds[(memberIds.indexOf(dealerMemberId) + 1) % memberIds.length]!
  const dealOrder = Array.from({ length: memberIds.length }, (_, offset) => {
    const index = (memberIds.indexOf(firstToReceive) + offset) % memberIds.length
    return memberIds[index]!
  })
  for (let card = 0; card < UNO_RULES.startingHandSize; card += 1) {
    for (const memberId of dealOrder) hands[memberId]!.push(drawPile.pop()!)
  }

  let topCardId = drawPile.pop()!
  while (getUnoCard(topCardId).kind === 'wild-draw-four') {
    drawPile.unshift(topCardId)
    topCardId = drawPile.pop()!
  }
  const topCard = getUnoCard(topCardId)
  const state: UnoState = {
    rulesVersion: 'classic-108.v1',
    phase: 'playing',
    roundNumber,
    turnOrder: [...memberIds],
    dealerMemberId,
    dealerSelection,
    direction: 1,
    activeMemberId: firstToReceive,
    activeColor: topCard.color,
    drawPile,
    discardPile: [topCardId],
    hands,
    scores: { ...scores },
    turn: { startedAt: now },
    stats
  }

  if (topCard.kind === 'draw-two') {
    drawCards(state, firstToReceive, 2, shuffleDiscard)
    startNextTurn(state, firstToReceive, now)
  } else if (topCard.kind === 'skip') {
    startNextTurn(state, firstToReceive, now)
  } else if (topCard.kind === 'reverse') {
    state.direction = -1
    state.activeMemberId = dealerMemberId
  } else if (topCard.kind === 'wild') {
    state.activeColor = undefined
    state.startingWildChooserMemberId = firstToReceive
  }
  return state
}

export function chooseUnoDealer(
  memberIds: readonly string[],
  drawRound: (contenders: readonly string[], round: number) => Record<string, UnoCard>
): { dealerMemberId: string, rounds: UnoDealerRound[] } {
  let contenders = [...memberIds]
  const rounds: UnoDealerRound[] = []
  for (let round = 0; contenders.length > 1; round += 1) {
    if (round > 100) throw new Error('UNO dealer selection did not resolve')
    const cards = drawRound(contenders, round)
    const draws = contenders.map((memberId) => {
      const card = cards[memberId]
      if (!card) throw new Error('UNO dealer draw is missing')
      return { memberId, card }
    })
    const high = Math.max(...draws.map(draw => unoDealerCardValue(draw.card)))
    contenders = draws.filter(draw => unoDealerCardValue(draw.card) === high).map(draw => draw.memberId)
    rounds.push({ draws, tiedLeaderMemberIds: [...contenders] })
  }
  return { dealerMemberId: contenders[0]!, rounds }
}

export function createUnoState(
  memberIds: readonly string[],
  dealerMemberId: string,
  dealerSelection: UnoDealerRound[],
  deckOrder: readonly UnoCard[],
  shuffleDiscard: UnoShuffle,
  now: number
): UnoState {
  return dealRound(
    memberIds,
    dealerMemberId,
    deckOrder,
    Object.fromEntries(memberIds.map(memberId => [memberId, 0])),
    1,
    dealerSelection,
    shuffleDiscard,
    { cardsPlayed: 0, cardsDrawn: 0, challenges: 0 },
    now
  )
}

export function chooseUnoStartingColor(state: UnoState, actorMemberId: string, color: UnoColor, now: number): UnoTransitionResult {
  const next = clone(state)
  if (next.phase !== 'playing' || next.startingWildChooserMemberId !== actorMemberId) return { state, error: 'not_color_chooser' }
  next.activeColor = color
  next.startingWildChooserMemberId = undefined
  next.turn = { startedAt: now }
  next.lastAction = { type: 'color-chosen', memberId: actorMemberId, color, at: now }
  return { state: next }
}

export function playUnoCard(
  state: UnoState,
  settings: UnoSettings,
  actorMemberId: string,
  cardId: string,
  declaredColor: UnoColor | undefined,
  calledUno: boolean,
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  const next = clone(state)
  if (next.phase !== 'playing' || next.startingWildChooserMemberId || next.pendingWildDrawFour) return { state, error: 'invalid_state' }
  if (next.activeMemberId !== actorMemberId) return { state, error: 'not_your_turn' }
  const hand = next.hands[actorMemberId]
  if (!hand?.includes(cardId)) return { state, error: 'card_not_in_hand' }
  if (next.turn.drawnCardId && next.turn.drawnCardId !== cardId) return { state, error: 'drawn_card_only' }
  const card = getUnoCard(cardId)
  const topCardId = next.discardPile.at(-1)
  if (!topCardId || !isUnoCardPlayable(card, getUnoCard(topCardId), next.activeColor)) return { state, error: 'card_not_playable' }
  const isWild = card.kind === 'wild' || card.kind === 'wild-draw-four'
  if (isWild !== Boolean(declaredColor)) return { state, error: isWild ? 'color_required' : 'color_not_allowed' }

  const wildDrawFourWasLegal = card.kind === 'wild-draw-four'
    ? isWildDrawFourLegal(hand, next.activeColor, cardId)
    : true
  closeUnoWindow(next)
  hand.splice(hand.indexOf(cardId), 1)
  next.discardPile.push(cardId)
  next.activeColor = declaredColor ?? card.color
  next.turn = { startedAt: now }
  next.stats.cardsPlayed += 1
  const safelyCalledUno = calledUno && hand.length === 1
  next.lastAction = {
    type: 'played',
    memberId: actorMemberId,
    card,
    ...(declaredColor ? { chosenColor: declaredColor } : {}),
    calledUno: safelyCalledUno,
    at: now
  }
  if (hand.length === 1 && !safelyCalledUno) next.pendingUno = { memberId: actorMemberId }
  const wentOut = hand.length === 0

  if (card.kind === 'wild-draw-four') {
    next.pendingWildDrawFour = {
      playedByMemberId: actorMemberId,
      affectedMemberId: nextMember(next, actorMemberId),
      chosenColor: declaredColor!,
      wasLegal: wildDrawFourWasLegal,
      ...(wentOut ? { apparentWinnerMemberId: actorMemberId } : {})
    }
    next.activeMemberId = next.pendingWildDrawFour.affectedMemberId
    return { state: next }
  }

  if (card.kind === 'draw-two') {
    const affected = nextMember(next, actorMemberId)
    drawCards(next, affected, 2, shuffleDiscard)
    if (wentOut) finishRound(next, settings, actorMemberId)
    else startNextTurn(next, affected, now)
    return { state: next }
  }

  if (card.kind === 'reverse') {
    if (next.turnOrder.length === 2) next.activeMemberId = actorMemberId
    else {
      next.direction = next.direction === 1 ? -1 : 1
      startNextTurn(next, actorMemberId, now)
    }
  } else if (card.kind === 'skip') {
    startNextTurn(next, actorMemberId, now, 2)
  } else {
    startNextTurn(next, actorMemberId, now)
  }

  if (wentOut) finishRound(next, settings, actorMemberId)
  return { state: next }
}

export function drawUnoCard(
  state: UnoState,
  actorMemberId: string,
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  const next = clone(state)
  if (next.phase !== 'playing' || next.startingWildChooserMemberId || next.pendingWildDrawFour) return { state, error: 'invalid_state' }
  if (next.activeMemberId !== actorMemberId) return { state, error: 'not_your_turn' }
  if (next.turn.drawnCardId) return { state, error: 'already_drew' }
  closeUnoWindow(next)
  const [cardId] = drawCards(next, actorMemberId, 1, shuffleDiscard)
  if (!cardId) return { state, error: 'no_cards_available' }
  next.lastAction = { type: 'drew', memberId: actorMemberId, count: 1, at: now }
  const topCardId = next.discardPile.at(-1)!
  if (isUnoCardPlayable(getUnoCard(cardId), getUnoCard(topCardId), next.activeColor)) next.turn.drawnCardId = cardId
  else startNextTurn(next, actorMemberId, now)
  return { state: next }
}

export function passUnoTurn(state: UnoState, actorMemberId: string, now: number): UnoTransitionResult {
  const next = clone(state)
  if (next.phase !== 'playing' || next.pendingWildDrawFour || next.activeMemberId !== actorMemberId || !next.turn.drawnCardId) {
    return { state, error: 'cannot_pass' }
  }
  startNextTurn(next, actorMemberId, now)
  return { state: next }
}

export function callUno(state: UnoState, actorMemberId: string, now: number): UnoTransitionResult {
  const next = clone(state)
  if (next.pendingUno?.memberId !== actorMemberId) return { state, error: 'uno_call_not_available' }
  next.pendingUno = undefined
  next.lastAction = { type: 'uno-called', memberId: actorMemberId, at: now }
  return { state: next }
}

export function catchUno(
  state: UnoState,
  actorMemberId: string,
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  const next = clone(state)
  const vulnerableMemberId = next.pendingUno?.memberId
  if (!vulnerableMemberId || vulnerableMemberId === actorMemberId) return { state, error: 'uno_catch_not_available' }
  drawCards(next, vulnerableMemberId, 2, shuffleDiscard)
  next.pendingUno = undefined
  next.lastAction = { type: 'uno-caught', memberId: vulnerableMemberId, caughtByMemberId: actorMemberId, at: now }
  return { state: next }
}

export function respondToWildDrawFour(
  state: UnoState,
  settings: UnoSettings,
  actorMemberId: string,
  response: 'accept' | 'challenge',
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  const next = clone(state)
  const pending = next.pendingWildDrawFour
  if (next.phase !== 'playing' || !pending || pending.affectedMemberId !== actorMemberId) return { state, error: 'challenge_not_available' }
  closeUnoWindow(next)
  next.pendingWildDrawFour = undefined
  if (response === 'accept') {
    drawCards(next, actorMemberId, 4, shuffleDiscard)
    if (pending.apparentWinnerMemberId) finishRound(next, settings, pending.apparentWinnerMemberId)
    else startNextTurn(next, actorMemberId, now)
    return { state: next }
  }

  next.stats.challenges += 1
  if (pending.wasLegal) {
    drawCards(next, actorMemberId, 6, shuffleDiscard)
    next.lastAction = {
      type: 'challenge',
      playedByMemberId: pending.playedByMemberId,
      challengedByMemberId: actorMemberId,
      verdict: 'legal',
      cardsDrawn: 6,
      at: now
    }
    if (pending.apparentWinnerMemberId) finishRound(next, settings, pending.apparentWinnerMemberId)
    else startNextTurn(next, actorMemberId, now)
  } else {
    drawCards(next, pending.playedByMemberId, 4, shuffleDiscard)
    next.lastAction = {
      type: 'challenge',
      playedByMemberId: pending.playedByMemberId,
      challengedByMemberId: actorMemberId,
      verdict: 'illegal',
      cardsDrawn: 4,
      at: now
    }
    next.activeMemberId = actorMemberId
    next.turn = { startedAt: now }
  }
  return { state: next }
}

export function continueUnoRound(
  state: UnoState,
  deckOrder: readonly UnoCard[],
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  if (state.phase !== 'round-results') return { state, error: 'invalid_state' }
  return {
    state: dealRound(
      state.turnOrder,
      clockwiseMember(state.turnOrder, state.dealerMemberId),
      deckOrder,
      state.scores,
      state.roundNumber + 1,
      [],
      shuffleDiscard,
      { ...state.stats },
      now
    )
  }
}

export function resolveDisconnectedUnoTurn(
  state: UnoState,
  settings: UnoSettings,
  targetMemberId: string,
  shuffleDiscard: UnoShuffle,
  now: number
): UnoTransitionResult {
  if (state.startingWildChooserMemberId === targetMemberId) {
    const result = chooseUnoStartingColor(state, targetMemberId, strongestHandColor(state, targetMemberId), now)
    if (!result.error) result.state.lastAction = { type: 'disconnect-resolved', memberId: targetMemberId, at: now }
    return result
  }
  if (state.pendingWildDrawFour?.affectedMemberId === targetMemberId) {
    const result = respondToWildDrawFour(state, settings, targetMemberId, 'accept', shuffleDiscard, now)
    if (!result.error) result.state.lastAction = { type: 'disconnect-resolved', memberId: targetMemberId, at: now }
    return result
  }
  if (state.activeMemberId !== targetMemberId || state.phase !== 'playing') return { state, error: 'invalid_target' }
  if (state.turn.drawnCardId) {
    const result = passUnoTurn(state, targetMemberId, now)
    if (!result.error) result.state.lastAction = { type: 'disconnect-resolved', memberId: targetMemberId, at: now }
    return result
  }
  const drawn = drawUnoCard(state, targetMemberId, shuffleDiscard, now)
  if (drawn.error) return drawn
  const result = drawn.state.turn.drawnCardId ? passUnoTurn(drawn.state, targetMemberId, now) : drawn
  result.state.lastAction = { type: 'disconnect-resolved', memberId: targetMemberId, at: now }
  return result
}

export function unoBlockingMemberId(state: UnoState): string | undefined {
  return state.pendingWildDrawFour?.affectedMemberId ?? state.startingWildChooserMemberId ?? state.activeMemberId
}

export function playableUnoCardIds(state: UnoState, memberId: string): string[] {
  if (state.phase !== 'playing' || state.activeMemberId !== memberId || state.startingWildChooserMemberId || state.pendingWildDrawFour) return []
  const topCardId = state.discardPile.at(-1)
  if (!topCardId) return []
  const candidates = state.turn.drawnCardId ? [state.turn.drawnCardId] : state.hands[memberId] ?? []
  return candidates.filter(cardId => isUnoCardPlayable(getUnoCard(cardId), getUnoCard(topCardId), state.activeColor))
}
