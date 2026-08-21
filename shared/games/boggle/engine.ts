import {
  BOGGLE_DISTRIBUTION_VERSION,
  BOGGLE_MULTI_LETTER_TILES,
  diceForSize,
  multiLetterTileCount
} from './dice'
import {
  BOGGLE_DICTIONARY_VERSION,
  boggleDictionaryHas,
  boggleDictionaryHasPrefix
} from './dictionary'
import { BOGGLE_BOARD_COLORS } from './types'
import type {
  BoggleBoard,
  BoggleSettings,
  MemberRoundScore,
  ScoredWord,
  WordSubmission,
  WordValidation
} from './types'

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

const BOARD_CANDIDATE_COUNT = 48
const LINE_DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const

function pickWeightedMultiLetterTile(
  available: typeof BOGGLE_MULTI_LETTER_TILES[number][],
  random: () => number
): string {
  const totalWeight = available.reduce((total, tile) => total + tile.weight, 0)
  let selection = random() * totalWeight
  for (let index = 0; index < available.length; index += 1) {
    const tile = available[index]!
    selection -= tile.weight
    if (selection < 0) {
      available.splice(index, 1)
      return tile.letters
    }
  }

  return available.pop()?.letters ?? 'Th'
}

function addMultiLetterTiles(letters: string[], size: 4 | 5 | 6 | 7, random: () => number): void {
  const availableTiles = [...BOGGLE_MULTI_LETTER_TILES]
  const replaceableIndices = shuffled(
    letters.map((_, index) => index).filter(index => letters[index] !== 'Qu'),
    random
  )

  for (let index = 0; index < multiLetterTileCount(size); index += 1) {
    const target = replaceableIndices[index]
    if (target === undefined) return
    letters[target] = pickWeightedMultiLetterTile(availableTiles, random)
  }
}

function countStraightTriples(letters: readonly string[], size: number): number {
  let triples = 0
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const first = letters[row * size + column]
      for (const [rowStep, columnStep] of LINE_DIRECTIONS) {
        const endRow = row + rowStep * 2
        const endColumn = column + columnStep * 2
        if (endRow < 0 || endRow >= size || endColumn < 0 || endColumn >= size) continue
        if (
          first === letters[(row + rowStep) * size + column + columnStep]
          && first === letters[endRow * size + endColumn]
        ) triples += 1
      }
    }
  }
  return triples
}

function boardRepetitionScore(letters: readonly string[], size: number): number {
  const counts = new Map<string, number>()
  for (const tile of letters) counts.set(tile, (counts.get(tile) ?? 0) + 1)

  // A few repeated common letters are useful, but dense boards feel less varied.
  const duplicateAllowance = Math.ceil(letters.length / 8)
  let score = [...counts.values()].reduce((total, count) => {
    const excess = Math.max(0, count - duplicateAllowance)
    return total + excess * excess * 8
  }, 0)

  // Nearby duplicates are noticeable even when they do not form a full run.
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const current = letters[row * size + column]
      for (const [rowStep, columnStep] of LINE_DIRECTIONS) {
        const nextRow = row + rowStep
        const nextColumn = column + columnStep
        if (nextRow < 0 || nextRow >= size || nextColumn < 0 || nextColumn >= size) continue
        if (current === letters[nextRow * size + nextColumn]) score += 4
      }
    }
  }

  // A straight run of three is possible with physical dice, but especially
  // distracting on screen. Make any run dominate every softer tie-breaker.
  return score + countStraightTriples(letters, size) * 10_000
}

function rollBoardCandidate(settings: BoggleSettings, random: () => number): string[] {
  const letters = shuffled(diceForSize(settings.boardSize), random).map((die) => {
    const face = die[Math.floor(random() * die.length)] ?? 'E'
    return face === 'Q' ? 'Qu' : face
  })
  addMultiLetterTiles(letters, settings.boardSize, random)
  return letters
}

function selectBoardLetters(settings: BoggleSettings, random: () => number): string[] {
  let bestLetters: string[] = []
  let bestScore = Number.POSITIVE_INFINITY

  for (let candidate = 0; candidate < BOARD_CANDIDATE_COUNT; candidate += 1) {
    const letters = rollBoardCandidate(settings, random)
    const score = boardRepetitionScore(letters, settings.boardSize)
    if (score < bestScore) {
      bestLetters = letters
      bestScore = score
    }
  }

  return bestLetters
}

export function normalizeWord(input: string): string {
  return input.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

export function generateBoard(settings: BoggleSettings, seed: string): BoggleBoard {
  const random = randomFromSeed(seed)
  const tiles = selectBoardLetters(settings, random).map((letters, index) => ({
    id: index,
    row: Math.floor(index / settings.boardSize),
    column: index % settings.boardSize,
    letters
  }))
  const backgroundColor = settings.boardColor === 'random'
    ? BOGGLE_BOARD_COLORS[Math.floor(random() * BOGGLE_BOARD_COLORS.length)]!
    : settings.boardColor

  return {
    size: settings.boardSize,
    seed,
    backgroundColor,
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

const VALID_WORD_PATTERN = /^[a-z]+$/

function suppliedPathIsValid(board: BoggleBoard, word: string, path: number[]): boolean {
  if (path.length === 0 || path.length > board.tiles.length) return false
  if (path.some(tileId => !Number.isInteger(tileId) || tileId < 0 || tileId >= board.tiles.length)) return false
  if (new Set(path).size !== path.length) return false
  if (!path.every((tileId, index) => index === 0 || isAdjacent(board, path[index - 1]!, tileId))) return false
  return pathSpells(board, path) === word
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

  if (!VALID_WORD_PATTERN.test(normalizedWord)) {
    return { valid: false, normalizedWord, path: [], rejectionCode: 'word_invalid_characters' }
  }

  if (!boggleDictionaryHas(normalizedWord)) {
    return { valid: false, normalizedWord, path: [], rejectionCode: 'word_not_in_dictionary' }
  }

  if (suppliedPath !== undefined) {
    if (!suppliedPathIsValid(board, normalizedWord, suppliedPath)) {
      return { valid: false, normalizedWord, path: [], rejectionCode: 'word_path_invalid' }
    }
    return { valid: true, normalizedWord, path: suppliedPath }
  }

  const path = findWordPath(board, normalizedWord)
  if (!path) {
    return { valid: false, normalizedWord, path: [], rejectionCode: 'word_not_on_board' }
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
    if (!boggleDictionaryHasPrefix(word)) return
    if (word.length >= minWordLength && VALID_WORD_PATTERN.test(word) && boggleDictionaryHas(word)) words.add(word)

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
