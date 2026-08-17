import type { MaybeRefOrGetter } from 'vue'
import { onMounted, toValue, watch } from 'vue'

let audioContext: AudioContext | null = null
let unlockListenersAttached = false

function playCountdownTone(seconds: number, phase: 'round-end' | 'round-start') {
  if (!audioContext || audioContext.state !== 'running') return

  const finalBeat = phase === 'round-start' ? seconds === 1 : seconds <= 3
  const start = audioContext.currentTime
  const duration = finalBeat ? 0.16 : 0.09
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(finalBeat ? 880 : 660, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

async function unlockAudio() {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextClass) return
  audioContext ??= new AudioContextClass()

  if (audioContext.state === 'suspended') await audioContext.resume()
  if (audioContext.state === 'running') removeUnlockListeners()
}

function handleInteraction() {
  void unlockAudio()
}

function removeUnlockListeners() {
  window.removeEventListener('pointerdown', handleInteraction)
  window.removeEventListener('keydown', handleInteraction)
  unlockListenersAttached = false
}

export function prepareCountdownAudio() {
  if (import.meta.server || unlockListenersAttached || audioContext?.state === 'running') return

  window.addEventListener('pointerdown', handleInteraction)
  window.addEventListener('keydown', handleInteraction)
  unlockListenersAttached = true
}

export function playChatNotificationSound() {
  if (!audioContext || audioContext.state !== 'running') return

  const start = audioContext.currentTime
  for (const [index, frequency] of [660, 880].entries()) {
    const toneStart = start + index * 0.09
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, toneStart)
    gain.gain.setValueAtTime(0.0001, toneStart)
    gain.gain.exponentialRampToValueAtTime(0.09, toneStart + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.08)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(toneStart)
    oscillator.stop(toneStart + 0.08)
  }
}

export function useCountdownWarning(
  remainingSeconds: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean>
) {
  let lastPlayedSecond: number | null = null

  watch(
    () => [toValue(remainingSeconds), toValue(enabled)] as const,
    ([seconds, isEnabled]) => {
      if (seconds > 10) lastPlayedSecond = null
      if (!isEnabled || seconds < 1 || seconds > 10 || seconds === lastPlayedSecond) return

      lastPlayedSecond = seconds
      playCountdownTone(seconds, 'round-end')
    },
    { flush: 'post' }
  )

  onMounted(() => {
    prepareCountdownAudio()
  })
}

export function useRoundStartCountdownSound(remainingSeconds: MaybeRefOrGetter<number>) {
  let lastPlayedSecond: number | null = null

  watch(
    () => toValue(remainingSeconds),
    (seconds) => {
      if (seconds < 1 || seconds > 3 || seconds === lastPlayedSecond) return

      lastPlayedSecond = seconds
      playCountdownTone(seconds, 'round-start')
    },
    { flush: 'post', immediate: true }
  )

  onMounted(() => {
    prepareCountdownAudio()
  })
}
