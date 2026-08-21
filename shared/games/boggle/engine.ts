import englishWords from 'an-array-of-english-words/index.json' with { type: 'json' }
import { BOGGLE_DISTRIBUTION_VERSION, diceForSize } from './dice'
import type {
  BoggleBoard,
  BoggleSettings,
  MemberRoundScore,
  ScoredWord,
  WordSubmission,
  WordValidation
} from './types'

export const BOGGLE_DICTIONARY_VERSION = 'an-array-of-english-words@2.0.0-en-US'

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFromSeed(seed: string): () => number {
  let value = hashSeed(seed)
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = result[index]!
    result[index] = result[target]!
    result[target] = current
  }
  return result
}

export function normalizeWord(input: string): string {
  return input.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

export function generateBoard(settings: BoggleSettings, seed: string): BoggleBoard {
  const random = randomFromSeed(seed)
  const dice = shuffled(diceForSize(settings.boardSize), random)
  const tiles = dice.map((die, index) => {
    const face = die[Math.floor(random() * die.length)] ?? 'E'
    return {
      id: index,
      row: Math.floor(index / settings.boardSize),
      column: index % settings.boardSize,
      letters: face === 'Q' ? 'Qu' : face
    }
  })

  return {
    size: settings.boardSize,
    seed,
    distributionVersion: BOGGLE_DISTRIBUTION_VERSION,
    dictionaryVersion: BOGGLE_DICTIONARY_VERSION,
    tiles
  }
}

function isAdjacent(board: BoggleBoard, from: number, to: number): boolean {
  const source = board.tiles[from]
  const target = board.tiles[to]
  if (!source || !target) return false
  return Math.max(
    Math.abs(source.row - target.row),
    Math.abs(source.column - target.column)
  ) === 1
}

function pathSpells(board: BoggleBoard, path: number[]): string {
  return path.map(index => board.tiles[index]?.letters ?? '').join('').toLocaleLowerCase('en-US')
}

export function findWordPath(board: BoggleBoard, input: string): number[] | null {
  const word = normalizeWord(input)
  const visit = (tileIndex: number, offset: number, used: Set<number>, path: number[]): number[] | null => {
    const tile = board.tiles[tileIndex]
    if (!tile) return null
    const letters = tile.letters.toLocaleLowerCase('en-US')
    if (!word.startsWith(letters, offset)) return null

    const nextOffset = offset + letters.length
    const nextPath = [...path, tileIndex]
    if (nextOffset === word.length) return nextPath

    const nextUsed = new Set(used).add(tileIndex)
    for (const candidate of board.tiles) {
      if (!nextUsed.has(candidate.id) && isAdjacent(board, tileIndex, candidate.id)) {
        const found = visit(candidate.id, nextOffset, nextUsed, nextPath)
        if (found) return found
      }
    }
    return null
  }

  for (const tile of board.tiles) {
    const found = visit(tile.id, 0, new Set(), [])
    if (found) return found
  }
  return null
}

function dictionaryHas(word: string): boolean {
  const index = dictionaryLowerBound(word)
  return englishWords[index] === word
}

function dictionaryLowerBound(value: string): number {
  let low = 0
  let high = englishWords.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (englishWords[middle]! < value) low = middle + 1
    else high = middle
  }
  return low
}

function dictionaryHasPrefix(prefix: string): boolean {
  return englishWords[dictionaryLowerBound(prefix)]?.startsWith(prefix) ?? false
}

export function validateWord(
  board: BoggleBoard,
  settings: BoggleSettings,
  input: string,
  suppliedPath?: number[]
): WordValidation {
  const normalizedWord = normalizeWord(input)
  if (normalizedWord.length < settings.minWordLength) {
    return { valid: false, normalizedWord, path: [], rejectionCode: 'word_too_short' }
  }

  if (!/^[a-z]+$/.test(normalizedWord) || !dictionaryHas(normalizedWord)) {
    return { valid: false, normalizedWord, path: [], rejectionCode: 'word_not_in_dictionary' }
  }

  let path = suppliedPath ?? findWordPath(board, normalizedWord) ?? []
  if (suppliedPath) {
    const unique = new Set(suppliedPath)
    const legal = unique.size === suppliedPath.length
      && suppliedPath.every((tile, index) => index === 0 || isAdjacent(board, suppliedPath[index - 1]!, tile))
      && pathSpells(board, suppliedPath) === normalizedWord
    if (!legal) path = []
  }

  if (path.length === 0) {
    return { valid: false, normalizedWord, path, rejectionCode: 'word_not_on_board' }
  }

  return { valid: true, normalizedWord, path }
}

export function scoreWord(word: string): number {
  if (word.length <= 4) return 1
  if (word.length === 5) return 2
  if (word.length === 6) return 3
  if (word.length === 7) return 5
  return 11
}

export function findWordsOnBoard(board: BoggleBoard, minWordLength: number): string[] {
  const words = new Set<string>()

  const visit = (tileIndex: number, prefix: string, used: Set<number>): void => {
    const tile = board.tiles[tileIndex]
    if (!tile) return

    const word = prefix + tile.letters.toLocaleLowerCase('en-US')
    if (!dictionaryHasPrefix(word)) return
    if (word.length >= minWordLength && /^[a-z]+$/.test(word) && dictionaryHas(word)) words.add(word)

    const nextUsed = new Set(used).add(tileIndex)
    for (const candidate of board.tiles) {
      if (!nextUsed.has(candidate.id) && isAdjacent(board, tileIndex, candidate.id)) {
        visit(candidate.id, word, nextUsed)
      }
    }
  }

  for (const tile of board.tiles) visit(tile.id, '', new Set())
  return [...words].sort((left, right) => left.localeCompare(right))
}

export function findMissedWords(
  board: BoggleBoard,
  settings: BoggleSettings,
  submissions: WordSubmission[]
): string[] {
  const submittedWords = new Set(submissions.map(submission => submission.word))
  return findWordsOnBoard(board, settings.minWordLength).filter(word => !submittedWords.has(word))
}

export function scoreRound(submissions: WordSubmission[]): MemberRoundScore[] {
  const owners = new Map<string, Set<string>>()
  for (const submission of submissions) {
    const members = owners.get(submission.word) ?? new Set<string>()
    members.add(submission.memberId)
    owners.set(submission.word, members)
  }

  const byMember = new Map<string, MemberRoundScore>()
  for (const submission of submissions) {
    const duplicate = (owners.get(submission.word)?.size ?? 0) > 1
    const scored: ScoredWord = {
      ...submission,
      duplicate,
      points: duplicate ? 0 : scoreWord(submission.word)
    }
    const score = byMember.get(submission.memberId) ?? {
      memberId: submission.memberId,
      displayName: submission.displayName,
      points: 0,
      words: []
    }
    score.words.push(scored)
    score.points += scored.points
    byMember.set(submission.memberId, score)
  }

  return [...byMember.values()].sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName))
}
