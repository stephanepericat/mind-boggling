export const FARKLE_RULES = {
  version: 'classic.v1',
  openingThreshold: 500,
  diceCount: 6,
  sides: 6,
  disconnectGraceMs: 60_000
} as const

export const FARKLE_SCORE_TABLE = [
  { selection: 'One 1', score: 100 },
  { selection: 'One 5', score: 50 },
  { selection: 'Three 1s', score: 300 },
  { selection: 'Three 2s', score: 200 },
  { selection: 'Three 3s', score: 300 },
  { selection: 'Three 4s', score: 400 },
  { selection: 'Three 5s', score: 500 },
  { selection: 'Three 6s', score: 600 },
  { selection: 'Four of a kind', score: 1000 },
  { selection: 'Five of a kind', score: 2000 },
  { selection: 'Six of a kind', score: 3000 },
  { selection: '1–6 straight', score: 1500 },
  { selection: 'Three pairs', score: 1500 },
  { selection: 'Four of a kind + pair', score: 1500 },
  { selection: 'Two triplets', score: 2500 }
] as const
