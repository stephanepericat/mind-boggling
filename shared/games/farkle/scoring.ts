import type { FarkleScoringOption, FarkleScoreBreakdown, NumericRolledDie } from './types'

function groupByFace(dice: readonly NumericRolledDie[]): Map<number, NumericRolledDie[]> {
  const groups = new Map<number, NumericRolledDie[]>()
  for (const die of dice) groups.set(die.face, [...(groups.get(die.face) ?? []), die])
  return groups
}

function specialSixDiceScore(dice: readonly NumericRolledDie[]): FarkleScoreBreakdown | null {
  if (dice.length !== 6) return null
  const counts = [...groupByFace(dice).values()].map(group => group.length).sort((left, right) => right - left)
  const faces = new Set(dice.map(die => die.face))
  const dieIds = dice.map(die => die.id)
  if (counts[0] === 6) return { label: 'Six of a kind', score: 3000, dieIds }
  if (faces.size === 6) return { label: 'Straight', score: 1500, dieIds }
  if (counts.join(',') === '2,2,2') return { label: 'Three pairs', score: 1500, dieIds }
  if (counts.join(',') === '4,2') return { label: 'Four of a kind + pair', score: 1500, dieIds }
  if (counts.join(',') === '3,3') return { label: 'Two triplets', score: 2500, dieIds }
  return null
}

export function scoreSelection(dice: readonly NumericRolledDie[]): FarkleScoringOption | null {
  if (dice.length === 0 || dice.length > 6) return null
  if (new Set(dice.map(die => die.id)).size !== dice.length) return null
  if (dice.some(die => !Number.isInteger(die.face) || die.face < 1 || die.face > 6)) return null

  const special = specialSixDiceScore(dice)
  if (special) return { dieIds: [...special.dieIds], score: special.score, breakdown: [special] }

  const breakdown: FarkleScoreBreakdown[] = []
  for (const [face, group] of groupByFace(dice)) {
    const count = group.length
    if (count >= 3) {
      const used = count === 6 ? 6 : count === 5 ? 5 : count === 4 ? 4 : 3
      const score = used === 6 ? 3000 : used === 5 ? 2000 : used === 4 ? 1000 : face === 1 ? 300 : face * 100
      breakdown.push({
        label: used >= 4 ? `${used} of a kind` : `Three ${face}s`,
        score,
        dieIds: group.slice(0, used).map(die => die.id)
      })
      const remaining = group.slice(used)
      if (remaining.length > 0 && face !== 1 && face !== 5) return null
      for (const die of remaining) breakdown.push({ label: face === 1 ? 'One' : 'Five', score: face === 1 ? 100 : 50, dieIds: [die.id] })
      continue
    }
    if (face !== 1 && face !== 5) return null
    for (const die of group) breakdown.push({ label: face === 1 ? 'One' : 'Five', score: face === 1 ? 100 : 50, dieIds: [die.id] })
  }

  const consumed = new Set(breakdown.flatMap(item => item.dieIds))
  if (consumed.size !== dice.length) return null
  return {
    dieIds: dice.map(die => die.id),
    score: breakdown.reduce((total, item) => total + item.score, 0),
    breakdown
  }
}

export function enumerateScoringOptions(dice: readonly NumericRolledDie[]): FarkleScoringOption[] {
  const options: FarkleScoringOption[] = []
  for (let mask = 1; mask < 1 << dice.length; mask += 1) {
    const selected = dice.filter((_, index) => (mask & (1 << index)) !== 0)
    const score = scoreSelection(selected)
    if (score) options.push(score)
  }
  return options.sort((left, right) => right.score - left.score || left.dieIds.length - right.dieIds.length)
}

export function hasScoringOption(dice: readonly NumericRolledDie[]): boolean {
  return dice.some(die => die.face === 1 || die.face === 5)
    || [...groupByFace(dice).values()].some(group => group.length >= 3)
    || specialSixDiceScore(dice) !== null
}
