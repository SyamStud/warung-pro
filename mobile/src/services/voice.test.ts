import type { UtteranceOptions } from '@capacitor-community/speech-recognition';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const isNative = vi.fn<() => boolean>();
const checkPermissions = vi.fn<() => Promise<{ speechRecognition: string }>>();
const requestPermissions = vi.fn<() => Promise<{ speechRecognition: string }>>();
const start = vi.fn<(options?: UtteranceOptions) => Promise<{ matches?: string[] }>>();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNative() },
}));

vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    start: (options?: UtteranceOptions) => start(options),
  },
}));

import { VoiceError, cleanTranscript, voiceService } from './voice';

/** Pengganti Web Speech API peramban — hanya dipakai untuk menguji jalur dev. */
class FakeSpeechRecognition {
  static last: FakeSpeechRecognition | null = null;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.last = this;
  }

  start() {}
}

function installWebSpeech(): void {
  (globalThis as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    FakeSpeechRecognition;
}

beforeEach(() => {
  vi.clearAllMocks();
  isNative.mockReturnValue(true);
  checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  start.mockResolvedValue({ matches: ['susu'] });
});

afterEach(() => {
  delete (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  FakeSpeechRecognition.last = null;
});

/* --- Pembersihan ucapan --------------------------------------------------- */

test('membuang kata perintah di awal ucapan', () => {
  expect(cleanTranscript('cari susu')).toBe('susu');
  expect(cleanTranscript('Tolong cari harga produk Susu Kental Manis')).toBe('Susu Kental Manis');
  expect(cleanTranscript('berapa harga indomie goreng')).toBe('indomie goreng');
});

test('merapikan spasi dan tanda baca di ujung', () => {
  expect(cleanTranscript('  susu   ultra  ')).toBe('susu ultra');
  expect(cleanTranscript('susu kental manis.')).toBe('susu kental manis');
  expect(cleanTranscript('teh kotak…')).toBe('teh kotak');
});

test('mengembalikan kosong bila yang terdengar hanya kata perintah', () => {
  expect(cleanTranscript('cari')).toBe('');
  expect(cleanTranscript('tolong cari harga')).toBe('');
});

test('tidak mengubah nama produk yang bukan kata perintah', () => {
  expect(cleanTranscript('susu')).toBe('susu');
  expect(cleanTranscript('Kecap Manis')).toBe('Kecap Manis');
});

/* --- Android (plugin native) --------------------------------------------- */

test('mengembalikan nama produk yang diucapkan', async () => {
  start.mockResolvedValue({ matches: ['Susu Ultra 250ml'] });

  await expect(voiceService.listen()).resolves.toBe('Susu Ultra 250ml');
});

test('meminta sekali bicara saja, dengan bahasa Indonesia', async () => {
  await voiceService.listen();

  expect(start.mock.calls[0][0]).toMatchObject({
    language: 'id-ID',
    partialResults: false,
    popup: true,
  });
});

test('tidak meminta izin lagi bila izin mikrofon sudah ada', async () => {
  await voiceService.listen();

  expect(requestPermissions).not.toHaveBeenCalled();
});

test('meminta izin mikrofon bila belum diberikan', async () => {
  checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });

  await voiceService.listen();

  expect(requestPermissions).toHaveBeenCalledTimes(1);
});

test('izin ditolak → VoiceError "permission" yang bisa ditindaklanjuti', async () => {
  checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });
  requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'permission' });
  await expect(voiceService.listen()).rejects.toThrow(/izin mikrofon/i);
  expect(start).not.toHaveBeenCalled();
});

test('tidak terdengar apa pun → "no-speech"', async () => {
  start.mockRejectedValue(new Error('No match'));

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'no-speech' });
});

test('perangkat tanpa layanan pengenal suara → "unsupported"', async () => {
  start.mockRejectedValue(new Error('Speech recognition service is not available.'));

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'unsupported' });
});

test('pengenal suara butuh jaringan → "offline"', async () => {
  start.mockRejectedValue(new Error('Network error'));

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'offline' });
});

test('hasil kosong dianggap tidak terdengar', async () => {
  start.mockResolvedValue({ matches: [] });

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'no-speech' });
});

test('memakai tafsiran berikutnya bila yang pertama hanya kata perintah', async () => {
  start.mockResolvedValue({ matches: ['cari', 'susu kental manis'] });

  await expect(voiceService.listen()).resolves.toBe('susu kental manis');
});

test('semua pesan galat berbahasa Indonesia dan tidak menyebut istilah teknis', async () => {
  const reasons = ['unsupported', 'permission', 'no-speech', 'offline', 'failed'] as const;

  for (const reason of reasons) {
    const error = new VoiceError(reason);
    expect(error.message.length).toBeGreaterThan(10);
    expect(error.message).not.toMatch(/permission|no.?speech|error|undefined/i);
  }
});

/* --- Peramban (hanya untuk `npm run dev`) -------------------------------- */

test('peramban tanpa Web Speech API → "unsupported"', async () => {
  isNative.mockReturnValue(false);

  await expect(voiceService.listen()).rejects.toMatchObject({ reason: 'unsupported' });
});

test('peramban: hasil ucapan dikembalikan sebagai teks pencarian', async () => {
  isNative.mockReturnValue(false);
  installWebSpeech();

  const listening = voiceService.listen();
  FakeSpeechRecognition.last?.onresult?.({ results: [[{ transcript: 'Cari susu.' }]] });

  await expect(listening).resolves.toBe('susu');
  expect(FakeSpeechRecognition.last?.lang).toBe('id-ID');
});

test('peramban: hasil pertama tetap dipakai walau sesinya lalu ditutup', async () => {
  isNative.mockReturnValue(false);
  installWebSpeech();

  const listening = voiceService.listen();
  const recognition = FakeSpeechRecognition.last;
  recognition?.onresult?.({ results: [[{ transcript: 'susu' }]] });
  recognition?.onend?.();

  await expect(listening).resolves.toBe('susu');
});

test('peramban: izin mikrofon ditolak → "permission"', async () => {
  isNative.mockReturnValue(false);
  installWebSpeech();

  const listening = voiceService.listen();
  FakeSpeechRecognition.last?.onerror?.({ error: 'not-allowed' });

  await expect(listening).rejects.toMatchObject({ reason: 'permission' });
});
