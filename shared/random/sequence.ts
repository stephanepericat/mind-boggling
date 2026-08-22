import type { RandomSource } from './types'

export class SequenceRandomSource implements RandomSource {
  private index = 0

  constructor(private readonly values: readonly number[]) {
    if (values.length === 0) throw new Error('SequenceRandomSource requires at least one value')
  }

  nextUint32(): number {
    const value = this.values[this.index]
    if (value === undefined) throw new Error('SequenceRandomSource is exhausted')
    this.index += 1
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
      throw new RangeError('SequenceRandomSource values must be unsigned 32-bit integers')
    }
    return value
  }
}
