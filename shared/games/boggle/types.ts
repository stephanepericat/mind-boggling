export const BOGGLE_BOARD_COLORS = ['blue', 'orange', 'red', 'green', 'purple', 'black', 'turquoise'] as const

export type BoggleBoardColor = typeof BOGGLE_BOARD_COLORS[number]
export type BoggleBoardColorSetting = BoggleBoardColor | 'random'

export interface BoggleSettings {
  boardSize: 4 | 5 | 6 | 7
  boardColor: BoggleBoardColorSetting
  roundSeconds: 180 | 240 | 300
  minWordLength: 2 | 3 | 4
  rounds: 1 | 2 | 3 | 4 | 5
  countdownWarning: boolean
  locale: 'en-US'
}

export interface BoggleTile {
  id: number
  row: number
  column: number
  letters: string
}

export interface BoggleBoard {
  size: 4 | 5 | 6 | 7
  seed: string
  backgroundColor?: BoggleBoardColor
  distributionVersion: string
  dictionaryVersion: string
  tiles: BoggleTile[]
}

export interface WordSubmission {
  memberId: string
  displayName: string
  word: string
  path: number[]
  submittedAt: number
}

export type WordRejectionCode
  = | 'round_not_active'
    | 'word_too_short'
    | 'word_invalid_characters'
    | 'word_not_on_board'
    | 'word_not_in_dictionary'
    | 'word_path_invalid'
    | 'word_already_submitted'

export interface WordValidation {
  valid: boolean
  normalizedWord: string
  path: number[]
  rejectionCode?: WordRejectionCode
}

export interface ScoredWord extends WordSubmission {
  points: number
  duplicate: boolean
}

export interface MemberRoundScore {
  memberId: string
  displayName: string
  points: number
  words: ScoredWord[]
}
