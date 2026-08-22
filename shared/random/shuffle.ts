import type { RandomSource } from './types'
import { uniformIndex } from './uniform'

export function shuffle<Values>(values: readonly Values[], source: RandomSource): Values[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = uniformIndex(source, index + 1)
    ;[result[index], result[other]] = [result[other]!, result[index]!]
  }
  return result
}
