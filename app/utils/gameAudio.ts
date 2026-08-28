let audioContext: AudioContext | null = null
let unlockListenersAttached = false

function removeUnlockListeners() {
  if (import.meta.server) return
  window.removeEventListener('pointerdown', handleInteraction)
  window.removeEventListener('keydown', handleInteraction)
  unlockListenersAttached = false
}

async function unlockGameAudio() {
  if (import.meta.server) return
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextClass) return
  audioContext ??= new AudioContextClass()
  if (audioContext.state === 'suspended') await audioContext.resume()
  if (audioContext.state === 'running') removeUnlockListeners()
}

function handleInteraction() {
  void unlockGameAudio()
}

export function prepareGameAudio() {
  if (import.meta.server || unlockListenersAttached || audioContext?.state === 'running') return
  window.addEventListener('pointerdown', handleInteraction)
  window.addEventListener('keydown', handleInteraction)
  unlockListenersAttached = true
}

export function getRunningGameAudioContext(): AudioContext | null {
  return audioContext?.state === 'running' ? audioContext : null
}
