import { describe, expect, it } from 'vitest'
import { createUnoDeck, createUnoState, playUnoCard } from '../shared/games/uno'
import type { UnoSettings } from '../shared/games/uno'
import { projectRoomState } from '../workers/match-room/src/projection'
import type { RoomState } from '../workers/match-room/src/types'

const settings: UnoSettings = { rulesVersion: 'classic-108.v1', targetScore: 500, locale: 'en-US' }
const keepOrder = (ids: readonly string[]) => [...ids]

function room(): RoomState {
  const game = createUnoState(['host', 'guest'], 'guest', [], createUnoDeck(), keepOrder, 1)
  game.hands = {
    host: ['wild:wild-draw-four:0', 'red:7:0'],
    guest: ['yellow:2:0', 'green:3:0']
  }
  const used = new Set([...game.hands.host, ...game.hands.guest, 'red:5:0'])
  game.drawPile = createUnoDeck().map(card => card.id).filter(id => !used.has(id))
  game.discardPile = ['red:5:0']
  game.activeColor = 'red'
  game.activeMemberId = 'host'
  game.startingWildChooserMemberId = undefined
  game.turn = { startedAt: 1 }
  return {
    stateVersion: 2,
    id: 'uno-1',
    name: 'UNO night',
    status: 'active',
    hostMemberId: 'host',
    members: [
      { id: 'host', clerkUserId: 'user-host', displayName: 'Host', role: 'host', ready: true },
      { id: 'guest', clerkUserId: 'user-guest', displayName: 'Guest', role: 'player', ready: true }
    ],
    sequence: 2,
    presence: { host: { lastActivityAt: 1 }, guest: { lastActivityAt: 1 } },
    game: { key: 'uno.v1', settings, state: game }
  }
}

describe('UNO participant projection', () => {
  it('shows a viewer only their hand and opponent card count', () => {
    const view = projectRoomState(room(), 'host', new Set(['host', 'guest']))
    expect(view.game.key).toBe('uno.v1')
    if (view.game.key !== 'uno.v1') throw new Error('Expected UNO view')
    expect(view.game.view.hand.map(card => card.id)).toEqual(['wild:wild-draw-four:0', 'red:7:0'])
    expect(view.game.view.opponents).toEqual([{ memberId: 'guest', cardCount: 2 }])
    expect(JSON.stringify(view)).not.toContain('yellow:2:0')
    expect(JSON.stringify(view)).not.toContain('green:3:0')
  })

  it('never projects the Wild Draw Four legality result', () => {
    const state = room()
    if (state.game.key !== 'uno.v1' || !state.game.state) throw new Error('Expected UNO state')
    state.game.state = playUnoCard(
      state.game.state,
      settings,
      'host',
      'wild:wild-draw-four:0',
      'blue',
      false,
      keepOrder,
      2
    ).state
    const hostView = projectRoomState(state, 'host', new Set(['host', 'guest']))
    const guestView = projectRoomState(state, 'guest', new Set(['host', 'guest']))
    expect(JSON.stringify(hostView)).not.toContain('wasLegal')
    expect(JSON.stringify(guestView)).not.toContain('wasLegal')
    if (guestView.game.key !== 'uno.v1') throw new Error('Expected UNO view')
    expect(guestView.game.view.pendingWildDrawFour).toMatchObject({ affectedMemberId: 'guest', canRespond: true })
    expect(guestView.game.view.canCatchUno).toBe(true)
    if (hostView.game.key !== 'uno.v1') throw new Error('Expected UNO view')
    expect(hostView.game.view.canCallUno).toBe(true)
  })
})
