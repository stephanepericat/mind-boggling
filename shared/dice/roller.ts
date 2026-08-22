import type { RandomSource } from '../random/types'
import { uniformIndex } from '../random/uniform'
import type { DiceRoll, DieDefinition, RolledDie } from './types'

export function rollDie<Face>(definition: DieDefinition<Face>, source: RandomSource): RolledDie<Face> {
  if (definition.faces.length === 0) throw new Error(`Die ${definition.id} has no faces`)
  const faceIndex = uniformIndex(source, definition.faces.length)
  return { id: definition.id, face: definition.faces[faceIndex]!, faceIndex }
}

export function rollDice<Face>(options: {
  definitions: readonly DieDefinition<Face>[]
  source: RandomSource
  rollId: string
  rolledAt: number
}): DiceRoll<Face> {
  const ids = new Set(options.definitions.map(definition => definition.id))
  if (ids.size !== options.definitions.length) throw new Error('Die IDs must be unique within a roll')
  return {
    id: options.rollId,
    algorithmVersion: 'uniform-rejection.v1',
    rolledAt: options.rolledAt,
    dice: options.definitions.map(definition => rollDie(definition, options.source))
  }
}
