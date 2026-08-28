import type { MaybeRefOrGetter } from 'vue'
import { onMounted, toValue, watch } from 'vue'
import { getRunningGameAudioContext, prepareGameAudio } from '../utils/gameAudio'

export interface DiceRollSoundEvent {
  id: string
  diceCount: number
  occurredAt?: number
}

const ROLL_SOUND_FRESHNESS_MS = 4_000

function playImpact(context: AudioContext, at: number, volume: number, pitch: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(pitch, at)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(55, pitch * 0.42), at + 0.055)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + 0.08)
}

function playDiceRattle(diceCount: number) {
  const context = getRunningGameAudioContext()
  if (!context) return

  const duration = 0.92
  const sampleRate = context.sampleRate
  const buffer = context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    const progress = index / channel.length
    const envelope = (1 - progress) ** 1.7
    const clatter = Math.sin(progress * Math.PI * (32 + diceCount * 3)) ** 8
    channel[index] = (Math.random() * 2 - 1) * envelope * (0.12 + clatter * 0.5)
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const start = context.currentTime + 0.015
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(920, start)
  filter.Q.setValueAtTime(0.7, start)
  gain.gain.setValueAtTime(Math.min(0.16, 0.07 + diceCount * 0.012), start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)
  source.start(start)

  const impactCount = Math.max(3, Math.min(7, diceCount + 1))
  for (let index = 0; index < impactCount; index += 1) {
    const progress = index / Math.max(impactCount - 1, 1)
    playImpact(context, start + 0.1 + progress * 0.72, 0.055 * (1 - progress * 0.45), 150 + ((index * 47 + diceCount * 19) % 120))
  }
}

export function useDiceRollSound(
  rollEvent: MaybeRefOrGetter<DiceRollSoundEvent | null | undefined>,
  serverOffset: MaybeRefOrGetter<number> = 0
) {
  const playedIds = new Set<string>()
  let initialized = false

  watch(
    () => toValue(rollEvent),
    (event) => {
      const isInitialRun = !initialized
      initialized = true
      if (!event || playedIds.has(event.id)) return
      playedIds.add(event.id)
      if (isInitialRun && event.occurredAt === undefined) return
      if (event.occurredAt !== undefined && Date.now() + toValue(serverOffset) - event.occurredAt > ROLL_SOUND_FRESHNESS_MS) return
      playDiceRattle(event.diceCount)
    },
    { immediate: true }
  )

  onMounted(prepareGameAudio)
}
