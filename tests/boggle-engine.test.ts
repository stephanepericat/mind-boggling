import { describe, expect, it } from 'vitest'
import {
  BOGGLE_ROUND_COUNTDOWN_MS,
  boggleSettingsSchema,
  findMissedWords,
  findWordPath,
  findWordsOnBoard,
  generateBoard,
  matchCommandSchema,
  scoreRound,
  scoreWord,
  validateWord
} from '../shared/games/boggle'
import type { BoggleBoard, BoggleSettings, WordSubmission } from '../shared/games/boggle'

const settings: BoggleSettings = {
  boardSize: 4,
  roundSeconds: 180,
  minWordLength: 3,
  rounds: 3,
  countdownWarning: true,
  locale: 'en-US'
}

describe('Boggle settings', () => {
  it('uses a three-second pre-round countdown', () => {
    expect(BOGGLE_ROUND_COUNTDOWN_MS).toBe(3_000)
  })

  it('applies the MVP defaults', () => {
    expect(boggleSettingsSchema.parse({})).toEqual(settings)
  })

  it('rejects values outside the supported settings', () => {
    expect(() => boggleSettingsSchema.parse({ boardSize: 7 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ roundSeconds: 60 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ minWordLength: 5 })).toThrow()
    expect(() => boggleSettingsSchema.parse({ rounds: 6 })).toThrow()
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
  it.each([4, 5, 6] as const)('generates a deterministic %sx%s board', (size) => {
    const sizedSettings = { ...settings, boardSize: size }
    const left = generateBoard(sizedSettings, 'stable-seed')
    const right = generateBoard(sizedSettings, 'stable-seed')
    expect(left).toEqual(right)
    expect(left.tiles).toHaveLength(size * size)
    expect(new Set(left.tiles.map(tile => tile.id)).size).toBe(size * size)
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

  it('rejects reused, non-adjacent, short, and unknown words', () => {
    expect(validateWord(board, settings, 'cat', [0, 1, 0]).rejectionCode).toBe('word_not_on_board')
    expect(validateWord(board, settings, 'cat', [0, 2, 1]).rejectionCode).toBe('word_not_on_board')
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
