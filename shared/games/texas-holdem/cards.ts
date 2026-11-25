import type { HoldemCard, HoldemRank, HoldemSuit } from './types'

const ranks: readonly HoldemRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const suits: readonly HoldemSuit[] = ['c', 'd', 'h', 's']
export const holdemHandLabels = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'] as const

export function createHoldemDeck(): HoldemCard[] {
  return suits.flatMap(suit => ranks.map(rank => `${rank}${suit}` as const))
}

function evaluateFive(cards: HoldemCard[]): number[] {
  const values = cards.map(card => ranks.indexOf(card[0] as HoldemRank) + 2).sort((a, b) => b - a)
  const groups = [...new Set(values)].map(value => ({ value, count: values.filter(rank => rank === value).length }))
    .sort((a, b) => b.count - a.count || b.value - a.value)
  const [first, second] = groups
  const flush = cards.every(card => card[1] === cards[0]![1])
  const straight = groups.length === 5
    ? (values[0]! - values[4]! === 4 ? values[0]! : values.join() === '14,5,4,3,2' ? 5 : 0)
    : 0
  const byGroup = groups.map(group => group.value)
  if (flush && straight) return [8, straight]
  if (first?.count === 4) return [7, ...byGroup]
  if (first?.count === 3 && second?.count === 2) return [6, ...byGroup]
  if (flush) return [5, ...values]
  if (straight) return [4, straight]
  if (first?.count === 3) return [3, ...byGroup]
  if (first?.count === 2) return [second?.count === 2 ? 2 : 1, ...byGroup]
  return [0, ...values]
}

export function compareHoldemRanks(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - (right[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

export function evaluateHoldemHand(cards: readonly HoldemCard[]) {
  if (cards.length < 5 || cards.length > 7 || new Set(cards).size !== cards.length) {
    throw new RangeError('A poker hand needs five to seven different cards')
  }
  let bestFive: HoldemCard[] = []
  let rank: number[] = []
  // Out-of-range indices stand in for omissions when there are fewer than seven cards.
  const firstStart = cards.length === 5 ? 5 : 0
  for (let first = firstStart; first < 6; first += 1) {
    const secondStart = cards.length === 7 ? first + 1 : 6
    for (let second = secondStart; second <= 6; second += 1) {
      const five = cards.filter((_card, index) => index !== first && index !== second)
      const candidate = evaluateFive(five)
      if (!rank.length || compareHoldemRanks(candidate, rank) > 0) {
        rank = candidate
        bestFive = five
      }
    }
  }
  return { rank, bestFive, label: holdemHandLabels[rank[0]!]! }
}
