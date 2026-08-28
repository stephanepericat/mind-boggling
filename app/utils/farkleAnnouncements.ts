import type { FarkleState } from '../../shared/games/farkle'

export type HotDiceEvent = NonNullable<FarkleState['lastHotDice']>
export type FarkledResolution = Extract<NonNullable<FarkleState['lastResolution']>, { type: 'farkled' }>

export type FarkleAnnouncement
  = | { id: string, type: 'hot-dice', event: HotDiceEvent }
    | { id: string, type: 'farkle', event: FarkledResolution }

export const HOT_DICE_MESSAGE_MS = 2_500
export const FARKLE_MESSAGE_MS = 6_000
export const FARKLE_ANNOUNCEMENT_FRESHNESS_MS = 12_000

export function latestFarkleAnnouncements(
  hotDice: HotDiceEvent | undefined,
  resolution: FarkleState['lastResolution'],
  serverNow: number
): FarkleAnnouncement[] {
  const farkle = resolution?.type === 'farkled' ? resolution : undefined
  const latestAt = Math.max(hotDice?.at ?? -Infinity, resolution?.at ?? -Infinity)
  const isFresh = (at: number) => {
    const age = serverNow - at
    return age >= -5_000 && age <= FARKLE_ANNOUNCEMENT_FRESHNESS_MS
  }
  const announcements: FarkleAnnouncement[] = []

  if (hotDice && hotDice.at === latestAt && isFresh(hotDice.at)) {
    announcements.push({ id: `hot-dice:${hotDice.sourceRollId}`, type: 'hot-dice', event: hotDice })
  }
  if (farkle && farkle.at === latestAt && isFresh(farkle.at)) {
    announcements.push({ id: `farkle:${farkle.memberId}:${farkle.at}`, type: 'farkle', event: farkle })
  }
  return announcements
}
