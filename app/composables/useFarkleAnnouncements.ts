import type { MaybeRefOrGetter } from 'vue'
import { onScopeDispose, readonly, shallowRef, toValue, watch } from 'vue'
import type { FarkleState } from '../../shared/games/farkle'
import {
  FARKLE_MESSAGE_MS,
  HOT_DICE_MESSAGE_MS,
  latestFarkleAnnouncements
} from '../utils/farkleAnnouncements'
import type { FarkleAnnouncement, HotDiceEvent } from '../utils/farkleAnnouncements'

export function useFarkleAnnouncements(options: {
  hotDice: MaybeRefOrGetter<HotDiceEvent | undefined>
  resolution: MaybeRefOrGetter<FarkleState['lastResolution']>
  serverOffset: MaybeRefOrGetter<number>
}) {
  const current = shallowRef<FarkleAnnouncement | null>(null)
  const seenIds = new Set<string>()
  const queue: FarkleAnnouncement[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function showNext() {
    if (timer || current.value || queue.length === 0) return
    current.value = queue.shift()!
    const duration = current.value.type === 'hot-dice' ? HOT_DICE_MESSAGE_MS : FARKLE_MESSAGE_MS
    timer = setTimeout(() => {
      timer = null
      current.value = null
      showNext()
    }, duration)
  }

  function enqueue(announcement: FarkleAnnouncement) {
    if (seenIds.has(announcement.id)) return
    seenIds.add(announcement.id)
    queue.push(announcement)
    showNext()
  }

  function dismiss() {
    if (timer) clearTimeout(timer)
    timer = null
    current.value = null
    showNext()
  }

  watch(
    () => [toValue(options.hotDice), toValue(options.resolution)] as const,
    ([hotDice, resolution]) => {
      const serverNow = Date.now() + toValue(options.serverOffset)
      latestFarkleAnnouncements(hotDice, resolution, serverNow).forEach(enqueue)
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { announcement: readonly(current), dismiss }
}
