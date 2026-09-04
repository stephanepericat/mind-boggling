import { describe, expect, it } from 'vitest'
import {
  callUno,
  catchUno,
  chooseUnoDealer,
  chooseUnoStartingColor,
  continueUnoRound,
  createUnoDeck,
  createUnoState,
  drawUnoCard,
  getUnoCard,
  passUnoTurn,
  playUnoCard,
  resolveDisconnectedUnoTurn,
  respondToWildDrawFour
} from '../shared/games/uno'
import type { UnoSettings, UnoState } from '../shared/games/uno'

const settings: UnoSettings = { rulesVersion: 'classic-108.v1', targetScore: 250, locale: 'en-US' }
const keepOrder = (ids: readonly string[]) => [...ids]

function rigState(
  hands: Record<string, string[]>,
  options: { top?: string, active?: string, dealer?: string, direction?: 1 | -1 } = {}
): UnoState {
  const memberIds = Object.keys(hands)
  const dealer = options.dealer ?? memberIds.at(-1)!
  const initial = createUnoState(memberIds, dealer, [], createUnoDeck(), keepOrder, 1)
  const top = options.top ?? 'red:5:0'
  const used = new Set([top, ...Object.values(hands).flat()])
  initial.hands = structuredClone(hands)
  initial.drawPile = createUnoDeck().map(card => card.id).filter(id => !used.has(id))
  initial.discardPile = [top]
  initial.activeMemberId = options.active ?? memberIds[0]
  initial.activeColor = getUnoCard(top).color
  initial.startingWildChooserMemberId = undefined
  initial.pendingUno = undefined
  initial.pendingWildDrawFour = undefined
  initial.direction = options.direction ?? 1
  initial.turn = { startedAt: 1 }
  initial.stats = { cardsPlayed: 0, cardsDrawn: 0, challenges: 0 }
  return initial
}

function stateWithOpeningCard(cardId: string, memberIds = ['a', 'b', 'c']): UnoState {
  const deck = createUnoDeck()
  const openingIndex = deck.length - (memberIds.length * 7) - 1
  const sourceIndex = deck.findIndex(card => card.id === cardId)
  ;[deck[openingIndex], deck[sourceIndex]] = [deck[sourceIndex]!, deck[openingIndex]!]
  return createUnoState(memberIds, memberIds.at(-1)!, [], deck, keepOrder, 1)
}

describe('UNO engine', () => {
  it('selects a dealer by number value and reruns only tied leaders', () => {
    const rounds = [
      { a: getUnoCard('red:7:0'), b: getUnoCard('blue:7:0'), c: getUnoCard('green:3:0') },
      { a: getUnoCard('yellow:2:0'), b: getUnoCard('blue:8:0') }
    ]
    const result = chooseUnoDealer(['a', 'b', 'c'], (contenders) => {
      const cards = rounds.shift()!
      return Object.fromEntries(contenders.map(memberId => [memberId, cards[memberId as keyof typeof cards]!]))
    })
    expect(result.dealerMemberId).toBe('b')
    expect(result.rounds.map(round => round.tiedLeaderMemberIds)).toEqual([['a', 'b'], ['b']])
  })

  it('deals seven cards per player while preserving all 108 card IDs', () => {
    const state = createUnoState(['a', 'b', 'c'], 'c', [], createUnoDeck(), keepOrder, 1)
    expect(Object.values(state.hands).map(hand => hand.length)).toEqual([7, 7, 7])
    const allIds = [...state.drawPile, ...state.discardPile, ...Object.values(state.hands).flat()]
    expect(allIds).toHaveLength(108)
    expect(new Set(allIds)).toHaveLength(108)
  })

  it('enforces the two-to-eight-player table size', () => {
    expect(() => createUnoState(['a'], 'a', [], createUnoDeck(), keepOrder, 1)).toThrow('2–8 players')
    const ninePlayers = Array.from({ length: 9 }, (_, index) => `p${index}`)
    expect(() => createUnoState(ninePlayers, 'p8', [], createUnoDeck(), keepOrder, 1)).toThrow('2–8 players')
    expect(() => createUnoState(ninePlayers.slice(0, 8), 'p7', [], createUnoDeck(), keepOrder, 1)).not.toThrow()
  })

  it('applies action cards revealed as the opening discard', () => {
    const skipped = stateWithOpeningCard('red:skip:0')
    expect(skipped.activeMemberId).toBe('b')

    const reversed = stateWithOpeningCard('red:reverse:0')
    expect(reversed.direction).toBe(-1)
    expect(reversed.activeMemberId).toBe('c')

    const drawTwo = stateWithOpeningCard('red:draw-two:0')
    expect(drawTwo.hands.a).toHaveLength(9)
    expect(drawTwo.activeMemberId).toBe('b')

    const wild = stateWithOpeningCard('wild:wild:0')
    expect(wild.startingWildChooserMemberId).toBe('a')
    expect(wild.activeColor).toBeUndefined()
    const chosen = chooseUnoStartingColor(wild, 'a', 'blue', 7).state
    expect(chosen.activeColor).toBe('blue')
    expect(chosen.turn.startedAt).toBe(7)
    expect(chosen.lastAction).toMatchObject({ type: 'color-chosen', memberId: 'a', color: 'blue' })

    const drawFour = stateWithOpeningCard('wild:wild-draw-four:0')
    expect(drawFour.discardPile.at(-1)).not.toBe('wild:wild-draw-four:0')
  })

  it('matches by color and gives two-player Reverse back to its player', () => {
    const state = rigState({ a: ['red:reverse:0', 'blue:1:0'], b: ['yellow:2:0'] })
    const result = playUnoCard(state, settings, 'a', 'red:reverse:0', undefined, false, keepOrder, 2)
    expect(result.error).toBeUndefined()
    expect(result.state.activeMemberId).toBe('a')
    expect(result.state.pendingUno?.memberId).toBe('a')
  })

  it('allows a voluntary draw but only the drawn card can then be played', () => {
    const state = rigState({ a: ['red:7:0', 'blue:1:0'], b: ['yellow:2:0'] })
    state.drawPile = state.drawPile.filter(cardId => cardId !== 'red:9:0')
    state.drawPile.push('red:9:0')
    const drawn = drawUnoCard(state, 'a', keepOrder, 2)
    expect(drawn.state.turn.drawnCardId).toBe('red:9:0')
    expect(playUnoCard(drawn.state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 3).error).toBe('drawn_card_only')
    expect(passUnoTurn(drawn.state, 'a', 3).state.activeMemberId).toBe('b')
  })

  it('penalizes a missed UNO call until the next player acts', () => {
    const state = rigState({ a: ['red:7:0', 'blue:1:0'], b: ['yellow:2:0'] })
    const played = playUnoCard(state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 2).state
    expect(played.pendingUno?.memberId).toBe('a')
    const caught = catchUno(played, 'b', keepOrder, 3).state
    expect(caught.hands.a).toHaveLength(3)
    expect(caught.pendingUno).toBeUndefined()

    const calledState = playUnoCard(state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 2).state
    expect(callUno(calledState, 'a', 3).state.pendingUno).toBeUndefined()

    const tooLateState = playUnoCard(state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 2).state
    const afterDraw = drawUnoCard(tooLateState, 'b', keepOrder, 3).state
    expect(catchUno(afterDraw, 'b', keepOrder, 4).error).toBe('uno_catch_not_available')
  })

  it('penalizes an illegal Wild Draw Four when challenged', () => {
    const state = rigState({ a: ['wild:wild-draw-four:0', 'red:7:0'], b: ['yellow:2:0'] })
    const played = playUnoCard(state, settings, 'a', 'wild:wild-draw-four:0', 'blue', false, keepOrder, 2).state
    expect(played.pendingWildDrawFour?.wasLegal).toBe(false)
    expect(played.lastAction).toMatchObject({ type: 'played', chosenColor: 'blue' })
    const challenged = respondToWildDrawFour(played, settings, 'b', 'challenge', keepOrder, 3).state
    expect(challenged.hands.a).toHaveLength(5)
    expect(challenged.hands.b).toHaveLength(1)
    expect(challenged.activeMemberId).toBe('b')
    expect(challenged.lastAction).toMatchObject({ type: 'challenge', verdict: 'illegal', cardsDrawn: 4 })
  })

  it('makes an unsuccessful challenger draw six and lose the turn', () => {
    const state = rigState({ a: ['wild:wild-draw-four:0', 'blue:7:0'], b: ['yellow:2:0'], c: ['green:3:0'] })
    const played = playUnoCard(state, settings, 'a', 'wild:wild-draw-four:0', 'blue', false, keepOrder, 2).state
    const challenged = respondToWildDrawFour(played, settings, 'b', 'challenge', keepOrder, 3).state
    expect(challenged.hands.b).toHaveLength(7)
    expect(challenged.activeMemberId).toBe('c')
    expect(challenged.lastAction).toMatchObject({ type: 'challenge', verdict: 'legal', cardsDrawn: 6 })
  })

  it('waits for a final Wild Draw Four response before scoring the round', () => {
    const state = rigState({ a: ['wild:wild-draw-four:0'], b: ['blue:5:0'] })
    const played = playUnoCard(state, settings, 'a', 'wild:wild-draw-four:0', 'green', false, keepOrder, 2).state
    expect(played.phase).toBe('playing')
    expect(played.pendingWildDrawFour?.apparentWinnerMemberId).toBe('a')
    const accepted = respondToWildDrawFour(played, settings, 'b', 'accept', keepOrder, 3).state
    expect(accepted.phase).toBe('round-results')
    expect(accepted.hands.b).toHaveLength(5)
    expect(accepted.roundResult?.hands.find(hand => hand.memberId === 'b')?.cards).toHaveLength(5)
  })

  it('scores remaining hands and rotates the dealer for the next round', () => {
    const state = rigState({
      a: ['red:7:0'],
      b: ['wild:wild:0', 'blue:5:0'],
      c: ['green:draw-two:0']
    }, { dealer: 'c' })
    const result = playUnoCard(state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 2).state
    expect(result.phase).toBe('round-results')
    expect(result.roundResult?.points).toBe(75)
    expect(result.scores.a).toBe(75)
    const next = continueUnoRound(result, createUnoDeck(), keepOrder, 3).state
    expect(next.roundNumber).toBe(2)
    expect(next.dealerMemberId).toBe('a')
  })

  it('applies a final Draw Two before calculating the round score', () => {
    const state = rigState({ a: ['red:draw-two:0'], b: ['blue:5:0'] })
    const result = playUnoCard(state, settings, 'a', 'red:draw-two:0', undefined, false, keepOrder, 2).state
    expect(result.hands.b).toHaveLength(3)
    expect(result.roundResult?.hands.find(hand => hand.memberId === 'b')?.cards).toHaveLength(3)
  })

  it('finishes the match when a round score reaches the configured target', () => {
    const state = rigState({ a: ['red:7:0'], b: ['blue:5:0'] })
    state.scores.a = 245
    const result = playUnoCard(state, settings, 'a', 'red:7:0', undefined, false, keepOrder, 2).state
    expect(result.phase).toBe('finished')
    expect(result.winnerMemberId).toBe('a')
    expect(result.scores.a).toBe(250)
  })

  it('recycles the discard pile while preserving the top card', () => {
    const state = rigState({ a: ['blue:1:0'], b: ['yellow:2:0'] })
    state.drawPile = []
    state.discardPile = ['green:8:0', 'red:5:0']
    const result = drawUnoCard(state, 'a', keepOrder, 2).state
    expect(result.hands.a).toContain('green:8:0')
    expect(result.discardPile).toEqual(['red:5:0'])
  })

  it('chooses the disconnected opening player’s strongest hand color', () => {
    const state = rigState({ a: ['green:1:0', 'green:2:0', 'red:7:0'], b: ['yellow:2:0'] })
    state.activeColor = undefined
    state.startingWildChooserMemberId = 'a'
    const result = resolveDisconnectedUnoTurn(state, settings, 'a', keepOrder, 2).state
    expect(result.activeColor).toBe('green')
    expect(result.startingWildChooserMemberId).toBeUndefined()
    expect(result.lastAction).toMatchObject({ type: 'disconnect-resolved', memberId: 'a' })
  })
})
