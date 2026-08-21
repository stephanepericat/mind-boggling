import type { BoggleTile } from '../../shared/games/boggle'

export type BoggleBoardRotation = 0 | 1 | 2 | 3

export function turnBoggleBoard(rotation: BoggleBoardRotation, direction: -1 | 1): BoggleBoardRotation {
  return ((rotation + direction + 4) % 4) as BoggleBoardRotation
}

export function rotateBoggleBoardTiles(
  tiles: readonly BoggleTile[],
  size: number,
  rotation: BoggleBoardRotation
): BoggleTile[] {
  const displayIndex = (tile: BoggleTile): number => {
    if (rotation === 1) return tile.column * size + (size - 1 - tile.row)
    if (rotation === 2) return (size - 1 - tile.row) * size + (size - 1 - tile.column)
    if (rotation === 3) return (size - 1 - tile.column) * size + tile.row
    return tile.row * size + tile.column
  }

  return [...tiles].sort((left, right) => displayIndex(left) - displayIndex(right))
}
