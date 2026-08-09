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

export const BOGGLE_DISTRIBUTION_VERSION = 'en-US-dice-v1'

export function diceForSize(size: 4 | 5 | 6): string[] {
  if (size === 4) return DICE_4
  if (size === 5) return DICE_5
  return DICE_6
}
