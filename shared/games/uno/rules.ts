export const UNO_COLORS = ['red', 'yellow', 'green', 'blue'] as const
export const UNO_TARGET_SCORES = [250, 500, 1000] as const

export const UNO_RULES = {
  rulesVersion: 'classic-108.v1',
  startingHandSize: 7,
  deckSize: 108,
  disconnectGraceMs: 60_000,
  actionCardPoints: 20,
  wildCardPoints: 50
} as const
