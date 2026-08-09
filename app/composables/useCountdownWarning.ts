import type { MaybeRefOrGetter } from 'vue'
import { onMounted, toValue, watch } from 'vue'

let audioContext: AudioContext | null = null
let unlockListenersAttached = false

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

export function useCountdownWarning(
  remainingSeconds: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean>
) {
  let lastPlayedSecond: number | null = null

  function playTone(seconds: number) {
    if (!audioContext || audioContext.state !== 'running') return

    const start = audioContext.currentTime
    const duration = seconds <= 3 ? 0.16 : 0.09
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(seconds <= 3 ? 880 : 660, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  watch(
    () => [toValue(remainingSeconds), toValue(enabled)] as const,
    ([seconds, isEnabled]) => {
      if (seconds > 10) lastPlayedSecond = null
      if (!isEnabled || seconds < 1 || seconds > 10 || seconds === lastPlayedSecond) return

      lastPlayedSecond = seconds
      playTone(seconds)
    },
    { flush: 'post' }
  )

  onMounted(() => {
    prepareCountdownAudio()
  })
}
