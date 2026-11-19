/**
 * Sons gerados com Web Audio — nenhum arquivo de áudio externo.
 * Os tons são curtos e discretos: feedback, não trilha sonora.
 */

type Sound = 'move' | 'capture' | 'check' | 'end' | 'invalid';

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

interface Tone {
  frequency: number;
  duration: number;
  delay?: number;
  gain?: number;
  type?: OscillatorType;
}

const PATTERNS: Record<Sound, Tone[]> = {
  move: [{ frequency: 620, duration: 0.055, gain: 0.14 }],
  capture: [
    { frequency: 300, duration: 0.08, gain: 0.18 },
    { frequency: 180, duration: 0.1, delay: 0.03, gain: 0.1 },
  ],
  check: [
    { frequency: 740, duration: 0.07, gain: 0.14 },
    { frequency: 980, duration: 0.09, delay: 0.06, gain: 0.12 },
  ],
  end: [
    { frequency: 523, duration: 0.16, gain: 0.1 },
    { frequency: 659, duration: 0.16, delay: 0.1, gain: 0.1 },
    { frequency: 784, duration: 0.24, delay: 0.2, gain: 0.1 },
  ],
  invalid: [{ frequency: 150, duration: 0.12, gain: 0.12, type: 'triangle' }],
};

/** Toca um som se estiver habilitado. `volume` vai de 0 a 100. */
export function playSound(sound: Sound, enabled: boolean, volume: number): void {
  if (!enabled || volume <= 0) return;
  const ctx = getContext();
  if (!ctx) return;

  const master = (Math.max(0, Math.min(100, volume)) / 100) ** 2;
  const now = ctx.currentTime;

  for (const tone of PATTERNS[sound]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + (tone.delay ?? 0);

    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime((tone.gain ?? 0.12) * master, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration + 0.02);
  }
}
