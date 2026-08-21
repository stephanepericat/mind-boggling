const DICE_4 = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
  'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
  'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ'
]

const DICE_5 = [
  'AAAFRS', 'AAEEEE', 'AAFIRS', 'ADENNN', 'AEEEEM',
  'AEEGMU', 'AEGMNN', 'AFIRSY', 'BJKQXZ', 'CCNSTW',
  'CEIILT', 'CEILPT', 'CEIPST', 'DDHNOT', 'DHHLOR',
  'DHHNOW', 'DHLNOR', 'EIIITT', 'EMOTTT', 'ENSSSU',
  'FIPRSY', 'GORRVW', 'HIPRRY', 'NOOTUW', 'OOOTTU'
]

const DICE_6 = [
  ...DICE_5,
  'AAEEOO', 'AEEITU', 'AEIOUY', 'BCDFGH', 'CDLMNP',
  'DELRST', 'EINRST', 'GHLRST', 'MNPRST', 'NRTUVW', 'STWXYZ'
]

/**
 * Big Boggle's bonus cube uses common ordered pairs including Qu, Th, He,
 * Er, An, and In. Ch, Sh, and Ph broaden that idea for this digital version.
 * Th and Ph are weighted up slightly so they appear often enough to matter.
 */
export const BOGGLE_MULTI_LETTER_TILES = [
  { letters: 'Th', weight: 2 },
  { letters: 'Ph', weight: 2 },
  { letters: 'Qu', weight: 1 },
  { letters: 'He', weight: 1 },
  { letters: 'Er', weight: 1 },
  { letters: 'An', weight: 1 },
  { letters: 'In', weight: 1 },
  { letters: 'Ch', weight: 1 },
  { letters: 'Sh', weight: 1 }
] as const

export const BOGGLE_DISTRIBUTION_VERSION = 'en-US-balanced-dice-v2'

export function diceForSize(size: 4 | 5 | 6): string[] {
  if (size === 4) return DICE_4
  if (size === 5) return DICE_5
  return DICE_6
}

export function multiLetterTileCount(size: 4 | 5 | 6): number {
  return size === 6 ? 2 : 1
}
