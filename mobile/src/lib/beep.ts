/**
 * Scanner confirmation sound.
 *
 * Generated with the Web Audio API instead of shipping an audio file: the beep
 * always matches the app volume, needs no asset, and cannot be blocked by the
 * media element autoplay rules. Android WebViews still suspend an
 * `AudioContext` until the first user gesture, so `primeBeep` resumes it as
 * soon as the user touches the screen anywhere.
 */

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;

  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

/**
 * Resume the audio context on the first user gesture so the next beep is
 * audible. Returns a cleanup function for the effect that calls it.
 */
export function primeBeep(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const ctx = getContext();
  if (!ctx || ctx.state === 'running') return () => undefined;

  const unlock = () => {
    void ctx.resume().catch(() => undefined);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

/**
 * Short two-tone confirmation, the same shape as a handheld barcode scanner.
 * Silently does nothing where audio is unavailable.
 */
export function playScanBeep(): void {
  const ctx = getContext();
  if (!ctx) return;

  // A scan only happens after taps, but resuming here keeps the beep working
  // when the context was suspended while the app sat in the background.
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  const start = ctx.currentTime;
  const tones: Array<{ at: number; frequency: number; length: number }> = [
    { at: 0, frequency: 1568, length: 0.06 },
    { at: 0.07, frequency: 2093, length: 0.11 },
  ];

  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const from = start + tone.at;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, from);

    // Fast attack, exponential tail: a click-free "beep", not a buzz.
    gain.gain.setValueAtTime(0.0001, from);
    gain.gain.linearRampToValueAtTime(0.17, from + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, from + tone.length);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(from);
    oscillator.stop(from + tone.length + 0.02);
  }
}
