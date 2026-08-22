export interface DieDefinition<Face> {
  id: string
  faces: readonly Face[]
}

export interface RolledDie<Face> {
  id: string
  face: Face
  faceIndex: number
}

export interface DiceRoll<Face> {
  id: string
  algorithmVersion: 'uniform-rejection.v1'
  rolledAt: number
  dice: RolledDie<Face>[]
}
