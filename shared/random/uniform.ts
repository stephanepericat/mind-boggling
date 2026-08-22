import type { RandomSource } from './types'

const UINT32_RANGE = 0x1_0000_0000

export function uniformIndex(source: RandomSource, length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > UINT32_RANGE) {
    throw new RangeError('length must be an integer between 1 and 2^32')
  }

  const limit = Math.floor(UINT32_RANGE / length) * length
  let value: number
  do value = source.nextUint32()
  while (value >= limit)
  return value % length
}

export function uniformInt(source: RandomSource, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
    throw new RangeError('minimum and maximum must be safe integers with maximum >= minimum')
  }
  return minimum + uniformIndex(source, maximum - minimum + 1)
}
