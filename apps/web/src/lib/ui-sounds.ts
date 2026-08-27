const SOUND_STORAGE_KEY = 'mathitis_notifications_muted';

export type UiSound = 'clack' | 'thud' | 'bump';

/** Small, local mechanical sounds: no network request and safe to ignore. */
export function playUiSound(sound: UiSound): void {
  if (typeof window === 'undefined' || localStorage.getItem(SOUND_STORAGE_KEY) === '1') return;

  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, now);

    const oscillator = context.createOscillator();
    oscillator.connect(gain);
    oscillator.type = sound === 'thud' ? 'sine' : 'square';
    oscillator.frequency.setValueAtTime(sound === 'thud' ? 115 : sound === 'bump' ? 180 : 520, now);
    oscillator.frequency.exponentialRampToValueAtTime(sound === 'thud' ? 52 : 120, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(sound === 'thud' ? 0.12 : 0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (sound === 'thud' ? 0.22 : 0.08));
    oscillator.start(now);
    oscillator.stop(now + (sound === 'thud' ? 0.24 : 0.1));
    oscillator.onended = () => void context.close();
  } catch {
    // Sound is decorative and must never interfere with the interaction.
  }
}
