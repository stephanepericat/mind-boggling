import type { Ref } from 'vue'

const STORAGE_KEY = 'mind-boggling:uno-turn-sound'

export function useUnoTurnCue(isOwnTurn: Readonly<Ref<boolean>>) {
  const soundEnabled = shallowRef(true)
  let audioContext: AudioContext | null = null

  function getAudioContext(): AudioContext | null {
    if (!soundEnabled.value || !import.meta.client) return null
    audioContext ??= new AudioContext()
    return audioContext
  }

  async function playTurnCue() {
    const context = getAudioContext()
    if (!context) return

    if (context.state === 'suspended') await context.resume()
    const startedAt = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(0.1, startedAt + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.42)
    gain.connect(context.destination)

    for (const [frequency, delay] of [[523.25, 0], [659.25, 0.13]] as const) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startedAt + delay)
      oscillator.connect(gain)
      oscillator.start(startedAt + delay)
      oscillator.stop(startedAt + delay + 0.28)
    }
  }

  function primeAudio() {
    const context = getAudioContext()
    if (context?.state === 'suspended') void context.resume()
  }

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value
    localStorage.setItem(STORAGE_KEY, soundEnabled.value ? 'on' : 'off')
    if (soundEnabled.value) {
      primeAudio()
      void playTurnCue()
    }
  }

  onMounted(() => {
    soundEnabled.value = localStorage.getItem(STORAGE_KEY) !== 'off'
    window.addEventListener('pointerdown', primeAudio, { once: true })
    window.addEventListener('keydown', primeAudio, { once: true })
  })

  watch(isOwnTurn, (ownTurn, previousOwnTurn) => {
    if (ownTurn && !previousOwnTurn) void playTurnCue()
  })

  onScopeDispose(() => {
    if (!import.meta.client) return
    window.removeEventListener('pointerdown', primeAudio)
    window.removeEventListener('keydown', primeAudio)
    void audioContext?.close()
    audioContext = null
  })

  return {
    soundEnabled: readonly(soundEnabled),
    toggleSound
  }
}
