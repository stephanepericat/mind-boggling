import type { DieDefinition } from './types'

export function numericDie(id: string, sides: number): DieDefinition<number> {
  if (!Number.isSafeInteger(sides) || sides < 2) throw new RangeError('A numeric die must have at least two sides')
  return { id, faces: Array.from({ length: sides }, (_, index) => index + 1) }
}

export function numericDice(count: number, sides: number, prefix = 'd'): DieDefinition<number>[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('Dice count must be a positive integer')
  return Array.from({ length: count }, (_, index) => numericDie(`${prefix}${index + 1}`, sides))
}
