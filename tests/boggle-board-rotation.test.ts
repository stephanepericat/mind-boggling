import { describe, expect, it } from 'vitest'
import { rotateBoggleBoardTiles, turnBoggleBoard } from '../app/utils/boggleBoardRotation'
import type { BoggleTile } from '../shared/games/boggle'

const tiles: BoggleTile[] = Array.from({ length: 16 }, (_, id) => ({
  id,
  row: Math.floor(id / 4),
  column: id % 4,
  letters: String(id)
}))

describe('Boggle board rotation', () => {
  it('rotates tiles clockwise without changing their identities', () => {
    const rotated = rotateBoggleBoardTiles(tiles, 4, 1)

    expect(rotated.map(tile => tile.id)).toEqual([
      12, 8, 4, 0,
      13, 9, 5, 1,
      14, 10, 6, 2,
      15, 11, 7, 3
    ])
    expect(tiles.map(tile => tile.id)).toEqual(Array.from({ length: 16 }, (_, id) => id))
  })

  it('rotates tiles counter-clockwise', () => {
    expect(rotateBoggleBoardTiles(tiles, 4, 3).map(tile => tile.id)).toEqual([
      3, 7, 11, 15,
      2, 6, 10, 14,
      1, 5, 9, 13,
      0, 4, 8, 12
    ])
  })

  it('wraps cleanly after four quarter turns', () => {
    let rotation = turnBoggleBoard(0, 1)
    rotation = turnBoggleBoard(rotation, 1)
    rotation = turnBoggleBoard(rotation, 1)
    rotation = turnBoggleBoard(rotation, 1)

    expect(rotation).toBe(0)
    expect(turnBoggleBoard(0, -1)).toBe(3)
  })
})
