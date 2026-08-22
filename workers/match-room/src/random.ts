import type { RandomSource } from '../../../shared/random/types'

export class WebCryptoRandomSource implements RandomSource {
  private readonly buffer = new Uint32Array(32)
  private index = this.buffer.length

  nextUint32(): number {
    if (this.index >= this.buffer.length) {
      crypto.getRandomValues(this.buffer)
      this.index = 0
    }
    return this.buffer[this.index++]!
  }
}
