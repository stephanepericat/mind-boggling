import { UNO_COLORS, UNO_RULES } from './rules'
import type { UnoCard, UnoColor } from './types'

let deckCache: UnoCard[] | undefined
let cardCache: Map<string, UnoCard> | undefined

function coloredCard(color: UnoColor, kind: UnoCard['kind'], copy: number, number?: number): UnoCard {
  const face = kind === 'number' ? String(number) : kind
  return { id: `${color}:${face}:${copy}`, color, kind, ...(number === undefined ? {} : { number }) }
}

export function createUnoDeck(): UnoCard[] {
  const cards: UnoCard[] = []
  for (const color of UNO_COLORS) {
    cards.push(coloredCard(color, 'number', 0, 0))
    for (let number = 1; number <= 9; number += 1) {
      cards.push(coloredCard(color, 'number', 0, number), coloredCard(color, 'number', 1, number))
    }
    for (const kind of ['skip', 'reverse', 'draw-two'] as const) {
      cards.push(coloredCard(color, kind, 0), coloredCard(color, kind, 1))
    }
  }
  for (let copy = 0; copy < 4; copy += 1) {
    cards.push({ id: `wild:wild:${copy}`, kind: 'wild' })
    cards.push({ id: `wild:wild-draw-four:${copy}`, kind: 'wild-draw-four' })
  }
  return cards
}

function cardsById(): Map<string, UnoCard> {
  deckCache ??= createUnoDeck()
  cardCache ??= new Map(deckCache.map(card => [card.id, card]))
  return cardCache
}

export function getUnoCard(cardId: string): UnoCard {
  const card = cardsById().get(cardId)
  if (!card) throw new Error(`Unknown UNO card: ${cardId}`)
  return card
}

export function unoCardPoints(card: UnoCard): number {
  if (card.kind === 'number') return card.number ?? 0
  if (card.kind === 'wild' || card.kind === 'wild-draw-four') return UNO_RULES.wildCardPoints
  return UNO_RULES.actionCardPoints
}

export function unoDealerCardValue(card: UnoCard): number {
  return card.kind === 'number' ? card.number ?? 0 : 0
}

export function isUnoCardPlayable(card: UnoCard, topCard: UnoCard, activeColor?: UnoColor): boolean {
  if (card.kind === 'wild' || card.kind === 'wild-draw-four') return true
  if (card.color === activeColor) return true
  if (card.kind === 'number' && topCard.kind === 'number') return card.number === topCard.number
  return card.kind === topCard.kind
}

export function isWildDrawFourLegal(hand: readonly string[], activeColor: UnoColor | undefined, cardId: string): boolean {
  if (!activeColor) return true
  return !hand.some(id => id !== cardId && getUnoCard(id).color === activeColor)
}

export function cardLabel(card: UnoCard): string {
  if (card.kind === 'number') return `${card.color} ${card.number}`
  if (card.kind === 'wild') return 'Wild'
  if (card.kind === 'wild-draw-four') return 'Wild Draw Four'
  const action = card.kind === 'draw-two' ? 'Draw Two' : card.kind[0]!.toUpperCase() + card.kind.slice(1)
  return `${card.color} ${action}`
}
