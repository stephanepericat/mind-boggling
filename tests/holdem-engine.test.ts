import { describe, expect, it } from 'vitest'
import {
  actHoldem, compareHoldemRanks, createHoldemDeck, createHoldemState, dealNextHoldemHand,
  evaluateHoldemHand, expireHoldemTurn, holdemLegalActions, HOLDEM_RULES
} from '../shared/games/texas-holdem'
import type { HoldemAction, HoldemCard, HoldemSettings, HoldemState } from '../shared/games/texas-holdem'
import { shuffle } from '../shared/random/shuffle'
import { projectRoomState } from '../workers/match-room/src/projection'
import type { RoomState } from '../workers/match-room/src/types'

const fixed: HoldemSettings = { rulesVersion: 'no-limit.v1', format: 'fixed-hands', locale: 'en-US' }
const tournament: HoldemSettings = { ...fixed, format: 'tournament' }
const originalDeck = createHoldemDeck()

function deckWith(prefix: HoldemCard[]) {
  return [...prefix, ...originalDeck.filter(card => !prefix.includes(card))]
}

function start(ids: string[], settings = fixed, button = 0, deck = originalDeck) {
  return createHoldemState(ids, settings, button, deck, 0)
}

function act(state: HoldemState, action: HoldemAction, amount?: number, settings = fixed) {
  const turn = state.hand.turn!
  const result = actHoldem(state, settings, turn.memberId, {
    handNumber: state.hand.number, turnId: turn.id, action, amount
  }, turn.deadline - HOLDEM_RULES.turnMs + 1)
  if (!result.state) throw new Error(result.error)
  return result.state
}

function setOpeningStacks(state: HoldemState, stacks: number[]) {
  for (const [index, seat] of state.seats.entries()) {
    const player = state.hand.players.find(entry => entry.memberId === seat.memberId)!
    player.openingStack = stacks[index]!
    seat.stack = player.openingStack - player.streetChips
  }
}

describe('Hold’em evaluation', () => {
  it('uses five cards, including a wheel and complete kicker comparison', () => {
    expect(new Set(originalDeck).size).toBe(52)
    expect(evaluateHoldemHand(['Ac', '2s', '3d', '4c', '5s', 'Kd', '7d']).rank).toEqual([4, 5])
    const stronger = evaluateHoldemHand(['As', 'Ah', 'Kd', 'Qs', '9s', '2d', '3d'])
    const weaker = evaluateHoldemHand(['Ac', 'Ad', 'Kd', 'Js', '9s', '2d', '3d'])
    expect(compareHoldemRanks(stronger.rank, weaker.rank)).toBeGreaterThan(0)
    expect(evaluateHoldemHand(['Ac', 'Ad', 'As', 'Kc', 'Kd', 'Ks', 'Qd']).rank).toEqual([6, 14, 13])
    expect(evaluateHoldemHand(['2c', '4c', '8c', 'Tc', 'Qc', 'Ac']).rank).toEqual([5, 14, 12, 10, 8, 4])
    expect(evaluateHoldemHand(['2c', '4c', '8c', 'Tc', 'Qc']).bestFive).toHaveLength(5)
  })
})

describe('Hold’em betting', () => {
  it('gives the heads-up small blind the first preflop action and the big blind the first postflop action', () => {
    let state = start(['a', 'b'])
    expect(state.hand.turn?.memberId).toBe('a')
    expect(holdemLegalActions(state, 'a')).toMatchObject({ call: 5, wager: { action: 'raise', min: 20 } })
    state = act(state, 'call')
    expect(holdemLegalActions(state, 'b')).toMatchObject({ check: true, wager: { action: 'raise', min: 20 } })
    state = act(state, 'check')
    expect(state.hand.board).toEqual(originalDeck.slice(5, 8))
    expect(state.hand.turn?.memberId).toBe('b')
    expect(holdemLegalActions(state, 'b')?.wager).toMatchObject({ action: 'bet', min: 10 })
  })

  it.each([190, 210])('handles cumulative short all-ins to %i', (lastStack) => {
    let state = start(['a', 'b', 'c', 'd'], fixed, 1)
    setOpeningStacks(state, [1000, 1000, 150, lastStack])
    state = act(state, 'raise', 110)
    state = act(state, 'call')
    state = act(state, 'all-in')
    state = act(state, 'all-in')
    expect(state.hand.turn?.memberId).toBe('a')
    const legal = holdemLegalActions(state, 'a')!
    expect(legal.call).toBe(lastStack - 110)
    if (lastStack === 210) expect(legal.wager?.min).toBe(310)
    else expect(legal).toMatchObject({ wager: undefined, allIn: false })
  })

  it('uses the full big blind for the bring-in when a short blind has two opponents', () => {
    let state = start(['a', 'b', 'c'])
    while (state.hand.turn) state = act(state, 'fold')
    state.seats[0]!.stack = 10
    state.completedHands = 4
    state = dealNextHoldemHand(state, tournament, originalDeck, 100)
    expect(state.hand.bigBlind).toBe(20)
    expect(state.hand.turn?.memberId).toBe('b')
    expect(holdemLegalActions(state, 'b')?.call).toBe(20)
  })

  it('passes through a dead button and keeps the big blind moving when play becomes heads-up', () => {
    let state = start(['a', 'b', 'c', 'd'])
    while (state.hand.turn) state = act(state, 'fold')
    state.seats[1]!.stack = 0
    state = dealNextHoldemHand(state, fixed, originalDeck, state.nextDealAt!)
    expect(state.hand).toMatchObject({ button: 1, smallBlindSeat: 2, bigBlindSeat: 3 })
    while (state.hand.turn) state = act(state, 'fold')
    state.seats[2]!.stack = 0
    state = dealNextHoldemHand(state, fixed, originalDeck, state.nextDealAt!)
    expect(state.hand).toMatchObject({ button: 3, smallBlindSeat: 3, bigBlindSeat: 0 })
    expect(state.hand.turn?.memberId).toBe('d')
  })

  it('rejects stale and out-of-turn actions and resolves overdue decisions at the server clock', () => {
    const state = start(['a', 'b'])
    const turn = state.hand.turn!
    const decision = { handNumber: 1, turnId: turn.id, action: 'call' } as const
    expect(actHoldem(state, fixed, 'a', { ...decision, handNumber: 2 }, 10).error).toBe('stale_turn')
    expect(actHoldem(state, fixed, 'b', decision, 10).error).toBe('not_your_turn')
    expect(actHoldem(state, fixed, 'a', decision, turn.deadline).error).toBe('turn_expired')
    expect(expireHoldemTurn(state, fixed, turn.deadline).latestResult?.showdown).toEqual([])
    const called = act(state, 'call')
    const checked = expireHoldemTurn(called, fixed, 80_000)
    expect(checked.hand.street).toBe('flop')
    expect(checked.hand.turn?.deadline).toBe(105_000)
  })
})

describe('Hold’em settlement', () => {
  it('pays separately for each pot, includes folded chips, and returns unmatched chips', () => {
    const deck = deckWith(['Kc', 'Qc', '9c', 'Ac', 'Kd', 'Qd', '9d', 'Ad', '2c', '2s', '3h', '5d', '3c', '8s', '4c', 'Td'])
    let state = start(['a', 'b', 'c', 'd'], fixed, 0, deck)
    setOpeningStacks(state, [25, 60, 80, 50])
    state = act(state, 'call')
    state = act(state, 'all-in')
    state = act(state, 'all-in')
    state = act(state, 'all-in')
    state = act(state, 'fold')
    expect(state.latestResult?.awards).toEqual([
      { amount: 85, payouts: [{ memberId: 'a', chips: 85 }] },
      { amount: 70, payouts: [{ memberId: 'b', chips: 70 }] }
    ])
    expect(state.latestResult?.refunds).toEqual([{ memberId: 'c', chips: 20 }])
    expect(state.latestResult?.showdown.map(player => player.memberId)).not.toContain('d')
  })

  it('splits a board-playing tie and awards the odd chip clockwise from the button', () => {
    const deck = deckWith(['2c', '3c', '4c', '5c', '6c', '7c', '8c', 'Ah', 'Kh', 'Qh', '9c', 'Jh', 'Tc', 'Th'])
    let state = start(['a', 'b', 'c'], fixed, 0, deck)
    state = act(state, 'call')
    state = act(state, 'fold')
    while (state.hand.turn) state = act(state, 'check')
    expect(state.latestResult?.awards[0]).toEqual({
      amount: 25,
      payouts: [{ memberId: 'c', chips: 13 }, { memberId: 'a', chips: 12 }]
    })
  })

  it.each([[1000, 1000, [1, 2, 2]], [900, 1000, [1, 3, 2]]])('assigns places for tournament players busting with %i and %i', (b, c, placements) => {
    const deck = deckWith(['Kc', 'Qc', 'Ac', 'Kd', 'Qd', 'Ad', '2c', '2s', '3h', '5d', '3c', '8s', '4c', 'Td'])
    let state = start(['a', 'b', 'c'], tournament, 0, deck)
    setOpeningStacks(state, [1000, b, c])
    while (state.hand.turn) {
      const legal = holdemLegalActions(state, state.hand.turn.memberId)!
      state = act(state, legal.allIn ? 'all-in' : 'call', undefined, tournament)
    }
    expect(state.seats.map(seat => seat.placement)).toEqual(placements)
    expect(state.finishedAt).toBeDefined()
  })

  it('stops after exactly twelve hands, including shared first place', () => {
    let state = start(['a', 'b'])
    for (let hand = 1; hand <= 12; hand += 1) {
      state = act(state, 'fold')
      if (hand < 12) state = dealNextHoldemHand(state, fixed, originalDeck, state.nextDealAt!)
    }
    expect(state.completedHands).toBe(12)
    expect(state.finishedAt).toBeDefined()
    expect(state.seats.map(seat => [seat.stack, seat.placement])).toEqual([[1000, 1], [1000, 1]])
  })

  it('keeps chips conserved across full games with different seats and action sequences', () => {
    let seed = 8127
    const source = { nextUint32: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) }
    for (const settings of [fixed, tournament]) {
      for (let count = 2; count <= 8; count += 1) {
        const members = Array.from({ length: count }, (_item, index) => String(index))
        let state = start(members, settings, 0, shuffle(originalDeck, source))
        for (let transition = 0; state.finishedAt === undefined && transition < 2500; transition += 1) {
          const turn = state.hand.turn
          if (!turn) {
            state = dealNextHoldemHand(state, settings, shuffle(originalDeck, source), state.nextDealAt!)
            continue
          }
          const legal = holdemLegalActions(state, turn.memberId)!
          const choice = source.nextUint32() % 10
          if (choice < 2) state = act(state, 'fold', undefined, settings)
          else if (choice < 4 && legal.allIn) state = act(state, 'all-in', undefined, settings)
          else if (choice < 5 && legal.wager) state = act(state, legal.wager.action, legal.wager.min, settings)
          else state = act(state, legal.check ? 'check' : 'call', undefined, settings)
          const stacks = state.seats.reduce((sum, seat) => sum + seat.stack, 0)
          const pot = state.hand.turn ? state.hand.players.reduce((sum, player) => sum + player.totalChips, 0) : 0
          expect(stacks + pot).toBe(count * HOLDEM_RULES.startingStack)
          expect(state.seats.every(seat => seat.stack >= 0)).toBe(true)
        }
        expect(state.finishedAt).toBeDefined()
      }
    }
  })
})

describe('Hold’em participant projection', () => {
  it('exposes only the viewer’s hole cards and only gives actions to the acting seat', () => {
    const game = start(['host', 'guest'], fixed, 0, deckWith(['As', 'Qh', 'Ad', 'Qs', 'Jd']))
    const room: RoomState = {
      stateVersion: 2, id: 'poker-night', name: 'Poker night', status: 'active', hostMemberId: 'host',
      members: [
        { id: 'host', clerkUserId: 'clerk-host', displayName: 'Host', role: 'host', ready: true },
        { id: 'guest', clerkUserId: 'clerk-guest', displayName: 'Guest', role: 'player', ready: true }
      ],
      sequence: 5, presence: {},
      game: { key: 'texas-holdem.v1', settings: fixed, state: game }
    }
    const host = projectRoomState(room, 'host', new Set())
    const guest = projectRoomState(room, 'guest', new Set())
    if (host.gameKey !== 'texas-holdem.v1' || guest.gameKey !== 'texas-holdem.v1') throw new Error('Wrong projection')
    expect(host.game.view.cards).toEqual(['Qh', 'Qs'])
    expect(guest.game.view.cards).toEqual(['As', 'Ad'])
    expect(host.game.view.actions).toBeDefined()
    expect(guest.game.view.actions).toBeUndefined()
    expect(JSON.stringify(host)).not.toMatch(/"(As|Ad|Jd|deck|cursor|openingStack|clerkUserId)"/)
    expect(JSON.stringify(guest)).not.toMatch(/"(Qh|Qs|Jd)"/)
    if (room.game.key !== 'texas-holdem.v1') throw new Error('Wrong room state')
    room.game.state = act(game, 'fold')
    const settled = projectRoomState(room, 'guest', new Set())
    expect(JSON.stringify(settled)).not.toMatch(/"(Qh|Qs|Jd)"/)
  })
})
