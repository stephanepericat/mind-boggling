import { compareHoldemRanks, evaluateHoldemHand } from './cards'
import { holdemBlinds, HOLDEM_RULES } from './rules'
import type {
  HoldemCard, HoldemDecision, HoldemHandPlayer, HoldemHandResult, HoldemLegalActions,
  HoldemPlayerView, HoldemSettings, HoldemState, HoldemStreet
} from './types'

const streets: HoldemStreet[] = ['preflop', 'flop', 'turn', 'river']

function stack(state: HoldemState, memberId: string) {
  return state.seats.find(seat => seat.memberId === memberId)!
}

function clockwise<T>(items: readonly T[], after: number): T[] {
  return [...items.slice(after + 1), ...items.slice(0, after + 1)]
}

function nextFundedSeat(seats: HoldemState['seats'], after: number): number {
  return seats.indexOf(clockwise(seats, after).find(seat => seat.stack > 0)!)
}

function commitChips(state: HoldemState, player: HoldemHandPlayer, chips: number) {
  const seat = stack(state, player.memberId)
  const paid = Math.min(seat.stack, chips)
  seat.stack -= paid
  player.streetChips += paid
  player.totalChips += paid
}

function beginHand(state: Omit<HoldemState, 'hand'>, settings: HoldemSettings, deck: HoldemCard[], now: number, position: { button: number } | { previous: HoldemState['hand'] }): HoldemState {
  const seats = state.seats
  const headsUp = seats.filter(seat => seat.stack > 0).length === 2
  let button: number
  let smallBlindSeat: number
  let bigBlindSeat: number
  if ('button' in position) {
    button = position.button
    smallBlindSeat = headsUp ? button : nextFundedSeat(seats, button)
    bigBlindSeat = nextFundedSeat(seats, smallBlindSeat)
  } else {
    bigBlindSeat = nextFundedSeat(seats, position.previous.bigBlindSeat)
    // The previous big blind position owes the small blind. An empty seat skips its post.
    smallBlindSeat = headsUp ? nextFundedSeat(seats, bigBlindSeat) : position.previous.bigBlindSeat
    button = headsUp ? smallBlindSeat : position.previous.smallBlindSeat
  }
  const blinds = holdemBlinds(settings.format, state.completedHands, seats.length)
  const players = clockwise(seats, button).filter(seat => seat.stack > 0).map(seat => ({
    memberId: seat.memberId,
    cards: [] as HoldemCard[],
    openingStack: seat.stack,
    streetChips: 0,
    totalChips: 0,
    folded: false,
    lastFaced: null
  }))
  let cursor = 0
  for (let round = 0; round < 2; round += 1) {
    for (const player of players) player.cards.push(deck[cursor++]!)
  }
  const hand: HoldemState['hand'] = {
    number: state.completedHands + 1,
    button, smallBlindSeat, bigBlindSeat,
    smallBlind: blinds.small, bigBlind: blinds.big,
    deck, cursor, players, board: [], street: 'preflop',
    wager: blinds.big, fullRaise: blinds.big, decisions: 0
  }
  const next: HoldemState = { ...state, hand, nextDealAt: undefined }
  const smallBlind = players.find(player => player.memberId === seats[smallBlindSeat]!.memberId)
  if (smallBlind) commitChips(next, smallBlind, blinds.small)
  commitChips(next, players.find(player => player.memberId === seats[bigBlindSeat]!.memberId)!, blinds.big)
  advanceBetting(next, settings, bigBlindSeat, now)
  return next
}

export function createHoldemState(memberIds: string[], settings: HoldemSettings, button: number, deck: HoldemCard[], now: number): HoldemState {
  return beginHand({
    seats: memberIds.map(memberId => ({ memberId, stack: HOLDEM_RULES.startingStack })),
    completedHands: 0
  }, settings, deck, now, { button })
}

export function dealNextHoldemHand(state: HoldemState, settings: HoldemSettings, deck: HoldemCard[], now: number): HoldemState {
  const next = structuredClone(state)
  return beginHand(next, settings, deck, now, { previous: next.hand })
}

function amountsOwed(state: HoldemState, player: HoldemHandPlayer, canBet: boolean) {
  const hand = state.hand
  const target = canBet
    ? hand.wager
    : Math.max(0, ...hand.players.filter(other => other !== player && !other.folded).map(other => other.streetChips))
  return Math.max(0, target - player.streetChips)
}

export function holdemLegalActions(state: HoldemState, memberId: string): HoldemLegalActions | undefined {
  const hand = state.hand
  if (hand.turn?.memberId !== memberId) return undefined
  const player = hand.players.find(item => item.memberId === memberId)!
  const chips = stack(state, memberId).stack
  const canBet = hand.players.some(other => other !== player && !other.folded && stack(state, other.memberId).stack > 0)
  const owed = amountsOwed(state, player, canBet)
  const min = hand.wager + hand.fullRaise
  const max = player.streetChips + chips
  const canRaise = canBet && (player.lastFaced === null || hand.wager - player.lastFaced >= hand.fullRaise)
  return {
    check: owed === 0,
    call: Math.min(chips, owed),
    fold: true,
    allIn: chips <= owed || canRaise,
    wager: canRaise && max >= min ? { action: hand.wager === 0 ? 'bet' : 'raise', min, max } : undefined
  }
}

function potTiers(players: HoldemHandPlayer[]) {
  const levels = [...new Set(players.map(player => player.totalChips).filter(Boolean))].sort((a, b) => a - b)
  const pots: Array<{ amount: number, eligible: string[] }> = []
  const refunds: HoldemHandResult['refunds'] = []
  let previous = 0
  for (const level of levels) {
    const contributors = players.filter(player => player.totalChips >= level)
    const amount = (level - previous) * contributors.length
    previous = level
    if (contributors.length === 1) {
      refunds.push({ memberId: contributors[0]!.memberId, chips: amount })
      continue
    }
    const eligible = contributors.filter(player => !player.folded).map(player => player.memberId)
    const last = pots.at(-1)
    if (last && last.eligible.every((id, index) => eligible[index] === id) && last.eligible.length === eligible.length) last.amount += amount
    else pots.push({ amount, eligible })
  }
  return { pots, refunds }
}

function assignPlacements(state: HoldemState, settings: HoldemSettings, eliminated: HoldemHandPlayer[]) {
  if (settings.format === 'tournament') {
    const stillIn = state.seats.filter(seat => seat.stack > 0)
    eliminated.sort((a, b) => b.openingStack - a.openingStack)
    let place = 0
    eliminated.forEach((player, index) => {
      if (player.openingStack !== eliminated[index - 1]?.openingStack) place = stillIn.length + index + 1
      stack(state, player.memberId).placement = place
    })
    if (stillIn.length === 1) stillIn[0]!.placement = 1
  } else {
    let place = 0
    const ranked = [...state.seats].sort((a, b) => b.stack - a.stack)
    ranked.forEach((seat, index) => {
      if (seat.stack !== ranked[index - 1]?.stack) place = index + 1
      seat.placement = place
    })
  }
}

function settle(state: HoldemState, settings: HoldemSettings, now: number) {
  const hand = state.hand
  const live = hand.players.filter(player => !player.folded)
  const ranked = live.length === 1
    ? []
    : live.map(player => ({
        memberId: player.memberId,
        cards: player.cards,
        ...evaluateHoldemHand([...hand.board, ...player.cards])
      }))
  const { pots, refunds } = potTiers(hand.players)
  for (const refund of refunds) stack(state, refund.memberId).stack += refund.chips
  const awards = pots.map((pot) => {
    let winners: string[]
    if (live.length === 1) {
      winners = [live[0]!.memberId]
    } else {
      const candidates = ranked.filter(player => pot.eligible.includes(player.memberId))
        .sort((a, b) => compareHoldemRanks(b.rank, a.rank))
      winners = candidates.filter(player => compareHoldemRanks(player.rank, candidates[0]!.rank) === 0).map(player => player.memberId)
    }
    if (!winners.length) throw new Error('Poker pot has no eligible winner')
    const ordered = clockwise(state.seats, hand.button).filter(seat => winners.includes(seat.memberId))
    const share = Math.floor(pot.amount / ordered.length)
    const remainder = pot.amount % ordered.length
    const payouts = ordered.map((seat, index) => {
      const chips = share + Number(index < remainder)
      seat.stack += chips
      return { memberId: seat.memberId, chips }
    })
    return { amount: pot.amount, payouts }
  })
  state.latestResult = {
    handNumber: hand.number, board: [...hand.board], awards, refunds,
    showdown: ranked.map(({ memberId, cards, bestFive, label }) => ({ memberId, cards, bestFive, label }))
  }
  hand.turn = undefined
  state.completedHands += 1
  const funded = state.seats.filter(seat => seat.stack > 0).length
  const finished = funded === 1 || (settings.format === 'fixed-hands' && state.completedHands === HOLDEM_RULES.fixedHands)
  if (settings.format === 'tournament' || finished) {
    assignPlacements(state, settings, hand.players.filter(player => stack(state, player.memberId).stack === 0))
  }
  if (finished) state.finishedAt = now
  else state.nextDealAt = now + HOLDEM_RULES.intermissionMs
}

function advanceBetting(state: HoldemState, settings: HoldemSettings, after: number, now: number) {
  const hand = state.hand
  const live = hand.players.filter(player => !player.folded)
  if (live.length === 1) {
    settle(state, settings, now)
    return
  }
  const funded = live.filter(player => stack(state, player.memberId).stack > 0)
  const canBet = funded.length > 1
  const pending = funded.filter(player => amountsOwed(state, player, canBet) > 0 || (canBet && player.lastFaced === null))
  const seat = clockwise(state.seats, after).find(seat => pending.some(player => player.memberId === seat.memberId))
  if (seat) {
    hand.turn = { id: ++hand.decisions, memberId: seat.memberId, deadline: now + HOLDEM_RULES.turnMs }
    return
  }

  if (hand.street === 'river') {
    settle(state, settings, now)
    return
  }
  hand.street = streets[streets.indexOf(hand.street) + 1]!
  hand.cursor += 1
  const cardsToDeal = hand.street === 'flop' ? 3 : 1
  hand.board.push(...hand.deck.slice(hand.cursor, hand.cursor + cardsToDeal))
  hand.cursor += cardsToDeal
  hand.wager = 0
  hand.fullRaise = hand.bigBlind
  for (const player of hand.players) {
    player.streetChips = 0
    player.lastFaced = null
  }
  advanceBetting(state, settings, hand.button, now)
}

export function actHoldem(state: HoldemState, settings: HoldemSettings, memberId: string, decision: HoldemDecision, now: number) {
  const turn = state.hand.turn
  if (!turn || decision.handNumber !== state.hand.number || decision.turnId !== turn.id) return { error: 'stale_turn' } as const
  if (turn.memberId !== memberId) return { error: 'not_your_turn' } as const
  if (now >= turn.deadline) return { error: 'turn_expired' } as const

  const legal = holdemLegalActions(state, memberId)!
  const { action, amount } = decision
  const betting = action === 'bet' || action === 'raise'
  if ((action === 'check' && !legal.check) || (action === 'call' && legal.call === 0)
    || (action === 'all-in' && !legal.allIn)
    || (betting && (!legal.wager || legal.wager.action !== action
      || amount === undefined || !Number.isSafeInteger(amount) || amount < legal.wager.min || amount > legal.wager.max))) {
    return { error: 'illegal_action' } as const
  }

  const player = state.hand.players.find(item => item.memberId === memberId)!
  const chips = action === 'all-in'
    ? stack(state, memberId).stack
    : action === 'call'
      ? legal.call
      : betting ? amount! - player.streetChips : 0
  return { state: applyDecision(state, settings, memberId, action, chips, now) } as const
}

function applyDecision(state: HoldemState, settings: HoldemSettings, memberId: string, action: HoldemDecision['action'], chips: number, now: number) {
  const next = structuredClone(state)
  const hand = next.hand
  const player = hand.players.find(item => item.memberId === memberId)!
  if (action === 'fold') player.folded = true
  if (chips > 0) commitChips(next, player, chips)
  if (player.streetChips > hand.wager) {
    const increase = player.streetChips - hand.wager
    hand.wager = player.streetChips
    if (increase >= hand.fullRaise) hand.fullRaise = increase
  }
  player.lastFaced = hand.wager
  advanceBetting(next, settings, next.seats.indexOf(stack(next, memberId)), now)
  return next
}

export function expireHoldemTurn(state: HoldemState, settings: HoldemSettings, now: number): HoldemState {
  const turn = state.hand.turn
  if (!turn || now < turn.deadline) return state
  const legal = holdemLegalActions(state, turn.memberId)!
  return applyDecision(state, settings, turn.memberId, legal.check ? 'check' : 'fold', 0, now)
}

export function projectHoldem(state: HoldemState | null, settings: HoldemSettings, viewer: string): HoldemPlayerView {
  const hand = state?.hand
  const turn = hand?.turn
  const baseBlinds = holdemBlinds(settings.format, Math.max(0, (hand?.number ?? 1) - 1), state?.seats.length ?? 2)
  const handsUntilIncrease = state && settings.format === 'tournament' && baseBlinds.big < state.seats.length * HOLDEM_RULES.startingStack
    ? Math.max(0, (baseBlinds.level + 1) * HOLDEM_RULES.handsPerLevel - state.completedHands)
    : undefined
  return {
    handNumber: hand?.number ?? 0,
    completedHands: state?.completedHands ?? 0,
    street: turn ? hand?.street : undefined,
    board: hand?.board ?? [],
    cards: hand?.players.find(player => player.memberId === viewer)?.cards ?? [],
    seats: state?.seats.map((seat, index) => {
      const player = hand?.players.find(player => player.memberId === seat.memberId)
      return {
        memberId: seat.memberId,
        stack: seat.stack,
        placement: seat.placement,
        button: index === hand?.button,
        smallBlind: index === hand?.smallBlindSeat && Boolean(player),
        bigBlind: index === hand?.bigBlindSeat,
        commitment: turn ? player?.streetChips ?? 0 : 0,
        status: !player || (!turn && seat.stack === 0) ? 'out' : player.folded ? 'folded' : seat.stack === 0 ? 'all-in' : 'playing'
      }
    }) ?? [],
    pots: turn && hand
      ? [
          hand.players.reduce((sum, player) => sum + player.totalChips, 0),
          ...potTiers(hand.players).pots.slice(1).map(pot => pot.amount)
        ]
      : [],
    blinds: { small: baseBlinds.small, big: baseBlinds.big, handsUntilIncrease },
    turn,
    actions: state ? holdemLegalActions(state, viewer) : undefined,
    latestResult: state?.latestResult,
    nextDealAt: state?.nextDealAt
  }
}
