import { describe, expect, it } from 'vitest'
import {
  BOGGLE_ROUND_COUNTDOWN_MS,
  BOGGLE_BOARD_COLORS,
  BOGGLE_DICTIONARY_VERSION,
  BOGGLE_MULTI_LETTER_TILES,
  boggleSettingsSchema,
  findMissedWords,
  findWordPath,
  findWordsOnBoard,
  generateBoard,
  matchCommandSchema,
  normalizeWord,
  scoreRound,
  scoreWord,
  validateWord
} from '../shared/games/boggle'
import type { BoggleBoard, BoggleSettings, WordSubmission } from '../shared/games/boggle'

const settings: BoggleSettings = {
  boardSize: 4,
  boardColor: 'random',
  roundSeconds: 180,
  minWordLength: 3,
  rounds: 3,
  countdownWarning: true,
  locale: 'en-US'
}

const lineDirections = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const

function hasStraightTriple(board: BoggleBoard): boolean {
  for (const tile of board.tiles) {
    for (const [rowStep, columnStep] of lineDirections) {
      const middleRow = tile.row + rowStep
      const middleColumn = tile.column + columnStep
      const endRow = tile.row + rowStep * 2
      const endColumn = tile.column + columnStep * 2
      if (endRow < 0 || endRow >= board.size || endColumn < 0 || endColumn >= board.size) continue
      const middle = board.tiles[middleRow * board.size + middleColumn]
      const end = board.tiles[endRow * board.size + endColumn]
      if (middle?.letters === tile.letters && end?.letters === tile.letters) return true
    }
  }
  return false
}

describe('Boggle settings', () => {
  it('uses a three-second pre-round countdown', () => {
    expect(BOGGLE_ROUND_COUNTDOWN_MS).toBe(3_000)
  })

  it('applies the MVP defaults', () => {
    expect(boggleSettingsSchema.parse({})).toEqual(settings)
  })

  it('rejects values outside the supported settings', () => {
    expect(() => boggleSettingsSchema.parse({ boardSize: 8 })).toThrow()
    expect(boggleSettingsSchema.parse({ boardSize: 7 }).boardSize).toBe(7)
    expect(() => boggleSettingsSchema.parse({ roundSeconds: 60 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ minWordLength: 5 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ rounds: 6 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ boardColor: 'pink' })).toThrow()
  })

  it('accepts every supported board color', () => {
    const colors = ['random', 'blue', 'orange', 'red', 'green', 'purple', 'black', 'turquoise']
    expect(colors.map(boardColor => boggleSettingsSchema.parse({ boardColor }).boardColor)).toEqual(colors)
  })

  it('allows the countdown warning to be disabled', () => {
    expect(boggleSettingsSchema.parse({ countdownWarning: false }).countdownWarning).toBe(false)
  })
})

describe('match commands', () => {
  it('accepts an idempotent match cancellation command', () => {
    expect(matchCommandSchema.parse({
      type: 'match.cancel',
      idempotencyKey: 'cancel-match-1'
    })).toEqual({
      type: 'match.cancel',
      idempotencyKey: 'cancel-match-1'
    })
  })
})

describe('Boggle board generation', () => {
  it.each([4, 5, 6, 7] as const)('generates a deterministic %sx%s board', (size) => {
    const sizedSettings = { ...settings, boardSize: size }
    const left = generateBoard(sizedSettings, 'stable-seed')
    const right = generateBoard(sizedSettings, 'stable-seed')
    expect(left).toEqual(right)
    expect(left.tiles).toHaveLength(size * size)
    expect(new Set(left.tiles.map(tile => tile.id)).size).toBe(size * size)
    expect(left.dictionaryVersion).toBe(BOGGLE_DICTIONARY_VERSION)
  })

  it('resolves a random board color deterministically for each round seed', () => {
    const left = generateBoard(settings, 'random-color-seed')
    const right = generateBoard(settings, 'random-color-seed')

    expect(BOGGLE_BOARD_COLORS).toContain(left.backgroundColor)
    expect(right.backgroundColor).toBe(left.backgroundColor)
  })

  it('uses a fixed board color for every round when selected', () => {
    const fixedSettings = { ...settings, boardColor: 'orange' as const }

    expect(generateBoard(fixedSettings, 'first-round').backgroundColor).toBe('orange')
    expect(generateBoard(fixedSettings, 'second-round').backgroundColor).toBe('orange')
  })

  it('avoids straight runs of three identical tiles across seeded boards', () => {
    for (const size of [4, 5, 6, 7] as const) {
      const sizedSettings = { ...settings, boardSize: size }
      for (let seed = 0; seed < 250; seed += 1) {
        expect(hasStraightTriple(generateBoard(sizedSettings, `repetition-${size}-${seed}`))).toBe(false)
      }
    }
  })

  it('adds varied multi-letter tiles to every board', () => {
    const seen = new Set<string>()
    const counts = new Map<string, number>()
    for (let seed = 0; seed < 300; seed += 1) {
      const board = generateBoard(settings, `multi-letter-${seed}`)
      const multiLetterTiles = board.tiles.filter(tile => tile.letters.length > 1)
      expect(multiLetterTiles.length).toBeGreaterThanOrEqual(1)
      for (const tile of multiLetterTiles) {
        seen.add(tile.letters)
        counts.set(tile.letters, (counts.get(tile.letters) ?? 0) + 1)
      }
    }

    expect(seen).toEqual(new Set(BOGGLE_MULTI_LETTER_TILES.map(tile => tile.letters)))
    expect(counts.get('Th')).toBeGreaterThan(30)
    expect(counts.get('Ph')).toBeGreaterThan(30)

    const largeBoard = generateBoard({ ...settings, boardSize: 6 }, 'large-multi-letter-board')
    expect(largeBoard.tiles.filter(tile => tile.letters.length > 1).length).toBeGreaterThanOrEqual(2)

    const largestBoard = generateBoard({ ...settings, boardSize: 7 }, 'largest-multi-letter-board')
    expect(largestBoard.tiles.filter(tile => tile.letters.length > 1).length).toBeGreaterThanOrEqual(3)
  })

  it('enumerates a large board without returning short words', () => {
    const largeSettings = { ...settings, boardSize: 6 as const }
    const words = findWordsOnBoard(generateBoard(largeSettings, 'large-board-seed'), largeSettings.minWordLength)
    expect(words.length).toBeGreaterThan(0)
    expect(words.every(word => word.length >= largeSettings.minWordLength)).toBe(true)
  })
})

describe('word validation', () => {
  const board: BoggleBoard = {
    size: 4,
    seed: 'fixture',
    distributionVersion: 'test',
    dictionaryVersion: 'test',
    tiles: [
      'C', 'A', 'T', 'S',
      'D', 'O', 'G', 'E',
      'Qu', 'I', 'T', 'R',
      'L', 'N', 'M', 'P'
    ].map((letters, id) => ({ id, row: Math.floor(id / 4), column: id % 4, letters }))
  }

  it('finds adjacent paths and supports the Qu tile', () => {
    expect(findWordPath(board, 'cat')).toEqual([0, 1, 2])
    expect(findWordPath(board, 'quit')).toEqual([8, 9, 10])
    expect(validateWord(board, settings, 'QUIT').valid).toBe(true)
  })

  it('normalizes compatible Unicode input and reports invalid characters precisely', () => {
    expect(normalizeWord('  ＣＡＴ  ')).toBe('cat')
    expect(validateWord(board, settings, '  ＣＡＴ  ').valid).toBe(true)
    expect(validateWord(board, settings, 'c@t').rejectionCode).toBe('word_invalid_characters')
    expect(validateWord(board, settings, 'cat!').rejectionCode).toBe('word_invalid_characters')
  })

  it('uses the curated US-English dictionary without accepting list noise', () => {
    const spellingBoard: BoggleBoard = {
      ...board,
      tiles: [
        'C', 'O', 'L', 'O',
        'X', 'X', 'R', 'X',
        'X', 'X', 'X', 'X',
        'X', 'X', 'X', 'X'
      ].map((letters, id) => ({ id, row: Math.floor(id / 4), column: id % 4, letters }))
    }

    expect(validateWord(spellingBoard, settings, 'color', [0, 1, 2, 3, 6]).valid).toBe(true)
    expect(validateWord(spellingBoard, settings, 'colour').rejectionCode).toBe('word_not_in_dictionary')
    expect(validateWord(board, settings, 'thames').rejectionCode).toBe('word_not_in_dictionary')
    expect(validateWord(board, settings, 'usa').rejectionCode).toBe('word_not_in_dictionary')
    expect(validateWord(board, settings, 'zzz').rejectionCode).toBe('word_not_in_dictionary')
  })

  it('treats Th and Ph as ordered two-letter tiles', () => {
    const multiLetterBoard: BoggleBoard = {
      ...board,
      tiles: [
        'Th', 'A', 'T', 'X',
        'Ph', 'A', 'S', 'E',
        'R', 'I', 'N', 'G',
        'L', 'O', 'C', 'K'
      ].map((letters, id) => ({ id, row: Math.floor(id / 4), column: id % 4, letters }))
    }

    expect(findWordPath(multiLetterBoard, 'that')).toEqual([0, 1, 2])
    expect(findWordPath(multiLetterBoard, 'phase')).not.toBeNull()
    expect(validateWord(multiLetterBoard, settings, 'that').valid).toBe(true)
    expect(validateWord(multiLetterBoard, settings, 'phase', [4, 5, 6, 7]).valid).toBe(true)
  })

  it('rejects reused, non-adjacent, short, and unknown words', () => {
    expect(validateWord(board, settings, 'cat', [0, 1, 0]).rejectionCode).toBe('word_path_invalid')
    expect(validateWord(board, settings, 'cat', [0, 2, 1]).rejectionCode).toBe('word_path_invalid')
    expect(validateWord(board, settings, 'cat', []).rejectionCode).toBe('word_path_invalid')
    expect(validateWord(board, settings, 'cat', [0, 1, 99]).rejectionCode).toBe('word_path_invalid')
    expect(validateWord(board, settings, 'at').rejectionCode).toBe('word_too_short')
    expect(validateWord(board, settings, 'zzzz').rejectionCode).toBe('word_not_in_dictionary')
  })

  it('finds valid board words and excludes words submitted by any player', () => {
    const boardWords = findWordsOnBoard(board, settings.minWordLength)
    expect(boardWords).toContain('cat')
    expect(boardWords).toContain('quit')
    expect(boardWords).not.toContain('at')

    const missedWords = findMissedWords(board, settings, [
      { memberId: 'one', displayName: 'One', word: 'cat', path: [0, 1, 2], submittedAt: 1 },
      { memberId: 'two', displayName: 'Two', word: 'cat', path: [0, 1, 2], submittedAt: 2 }
    ])
    expect(missedWords).not.toContain('cat')
    expect(missedWords).toContain('quit')
    expect(missedWords).toEqual([...missedWords].sort((left, right) => left.localeCompare(right)))
  })
})

describe('scoring', () => {
  it('uses the standard Boggle score boundaries', () => {
    expect([3, 4, 5, 6, 7, 8].map(length => scoreWord('a'.repeat(length)))).toEqual([1, 1, 2, 3, 5, 11])
  })

  it('cancels duplicate words for every player', () => {
    const submissions: WordSubmission[] = [
      { memberId: 'one', displayName: 'One', word: 'cat', path: [0, 1, 2], submittedAt: 1 },
      { memberId: 'two', displayName: 'Two', word: 'cat', path: [0, 1, 2], submittedAt: 2 },
      { memberId: 'one', displayName: 'One', word: 'dogs', path: [3, 4, 5, 6], submittedAt: 3 }
    ]
    const scores = scoreRound(submissions)
    expect(scores.find(score => score.memberId === 'one')?.points).toBe(1)
    expect(scores.find(score => score.memberId === 'two')?.points).toBe(0)
    expect(scores.flatMap(score => score.words).filter(word => word.word === 'cat').every(word => word.duplicate && word.points === 0)).toBe(true)
  })
})
