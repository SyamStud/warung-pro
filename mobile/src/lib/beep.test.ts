import { afterEach, expect, test, vi } from 'vitest';

interface FakeOscillator {
  type: string;
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface FakeGain {
  connect: ReturnType<typeof vi.fn>;
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
}

function createFakes(state: AudioContextState = 'running') {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const resume = vi.fn(() => Promise.resolve());

  class FakeNode {
    connect = vi.fn(() => ({ connect: vi.fn() }));
  }

  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = resume;

    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        ...new FakeNode(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      const gain = {
        ...new FakeNode(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      };
      gains.push(gain);
      return gain;
    }
  }

  return { oscillators, gains, resume, Ctor: FakeAudioContext };
}

function stubAudioContext(Ctor: unknown) {
  Object.defineProperty(window, 'AudioContext', { value: Ctor, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioContext');
  vi.resetModules();
});

test('memainkan dua nada pendek saat barcode terbaca', async () => {
  const fakes = createFakes();
  stubAudioContext(fakes.Ctor);
  const { playScanBeep } = await import('./beep');

  playScanBeep();

  expect(fakes.oscillators).toHaveLength(2);
  expect(fakes.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(1568, 0);
  expect(fakes.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(2093, expect.any(Number));
  for (const oscillator of fakes.oscillators) {
    expect(oscillator.start).toHaveBeenCalled();
    expect(oscillator.stop).toHaveBeenCalled();
  }
  // Nada harus punya serangan cepat dan ekor eksponensial, bukan klik.
  expect(fakes.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.17, expect.any(Number));
  expect(fakes.gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
    0.0001,
    expect.any(Number),
  );
});

test('membatalkan suspend agar beep tetap terdengar', async () => {
  const fakes = createFakes('suspended');
  stubAudioContext(fakes.Ctor);
  const { playScanBeep } = await import('./beep');

  playScanBeep();

  expect(fakes.resume).toHaveBeenCalled();
  expect(fakes.oscillators).toHaveLength(2);
});

test('diam saja bila perangkat tidak punya Web Audio', async () => {
  const { playScanBeep, primeBeep } = await import('./beep');

  expect(playScanBeep).not.toThrow();
  expect(primeBeep()).toBeTypeOf('function');
});

test('primeBeep membuka audio pada sentuhan pertama lalu melepas listener', async () => {
  const fakes = createFakes('suspended');
  stubAudioContext(fakes.Ctor);
  const { primeBeep } = await import('./beep');

  const cleanup = primeBeep();
  window.dispatchEvent(new Event('pointerdown'));
  expect(fakes.resume).toHaveBeenCalledTimes(1);

  cleanup();
  window.dispatchEvent(new Event('pointerdown'));
  expect(fakes.resume).toHaveBeenCalledTimes(1);
});
