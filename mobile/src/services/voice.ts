import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export type VoiceErrorReason = 'unsupported' | 'permission' | 'no-speech' | 'offline' | 'failed';

/** Ucapan dianggap bahasa Indonesia: nama produk warung hampir selalu Indonesia. */
const LANGUAGE = 'id-ID';

/** Pengenal suara mengembalikan beberapa tafsiran sekaligus; ambil yang terbaik. */
const MAX_RESULTS = 5;

const PROMPT = 'Sebutkan nama produk';

/**
 * Pesan yang muncul di layar. Disimpan di sini supaya layanan dan halaman
 * memakai kalimat yang sama, dan tidak ada alasan teknis yang bocor ke pemakai.
 */
const MESSAGES: Record<VoiceErrorReason, string> = {
  unsupported: 'Perangkat ini belum punya pengenal suara. Ketik nama produk saja.',
  permission: 'Izin mikrofon ditolak. Aktifkan izin mikrofon untuk mencari dengan suara.',
  'no-speech': 'Tidak terdengar. Coba sebutkan nama produknya sekali lagi.',
  offline: 'Pengenal suara butuh internet. Periksa koneksi lalu coba lagi.',
  failed: 'Pencarian suara gagal. Coba lagi.',
};

export class VoiceError extends Error {
  constructor(
    public readonly reason: VoiceErrorReason,
    message: string = MESSAGES[reason],
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

/**
 * Kata yang biasanya mendahului nama barang waktu orang berbicara ("cari susu",
 * "berapa harga susu"). Dibuang **hanya di awal** ucapan, supaya yang dicari
 * benar-benar nama produknya — kalau ikut terkirim, pencariannya tidak ketemu.
 */
const COMMAND_WORDS = [
  'tolong',
  'coba',
  'cari',
  'carikan',
  'cek',
  'lihat',
  'tampilkan',
  'produk',
  'harga',
  'berapa',
  'nama',
];

/**
 * Membersihkan hasil pengenal suara menjadi kata kunci pencarian: spasi
 * dirapikan, kata perintah di awal dibuang, dan tanda baca di ujung dibuang.
 * Mengembalikan string kosong bila yang terdengar hanya kata perintah.
 */
export function cleanTranscript(raw: string): string {
  let text = (raw ?? '').replace(/\s+/g, ' ').trim();

  for (let changed = true; changed; ) {
    changed = false;
    const lowered = text.toLowerCase();

    for (const word of COMMAND_WORDS) {
      if (lowered === word) return '';
      if (lowered.startsWith(`${word} `)) {
        text = text.slice(word.length + 1).trim();
        changed = true;
        break;
      }
    }
  }

  return text.replace(/[.,!?;:]+$/g, '').replace(/…+$/g, '').trim();
}

/** Alternatif pertama yang masih menyisakan kata kunci, atau null bila kosong. */
function pickMatch(matches: string[]): string | null {
  for (const match of matches) {
    const text = cleanTranscript(match);
    if (text !== '') return text;
  }
  return null;
}

/** Pesan dari plugin native → alasan yang bisa ditindaklanjuti layar. */
function classifyNativeError(error: unknown): VoiceErrorReason {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();

  if (message.includes('permission')) return 'permission';
  if (message.includes('no match') || message.includes('no speech')) return 'no-speech';
  if (message.includes('network') || message.includes('server')) return 'offline';
  if (message.includes('not available') || message.includes('not supported')) return 'unsupported';

  return 'failed';
}

/** Bentuk Web Speech API yang kita pakai — tidak ada di lib.dom TypeScript. */
interface WebSpeechAlternative {
  transcript: string;
}

interface WebSpeechResult {
  readonly length: number;
  [index: number]: WebSpeechAlternative;
}

interface WebSpeechEvent {
  results: {
    readonly length: number;
    [index: number]: WebSpeechResult;
  };
}

interface WebSpeechInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  onresult: ((event: WebSpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type WebSpeechCtor = new () => WebSpeechInstance;

function webSpeechCtor(): WebSpeechCtor | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: WebSpeechCtor;
    webkitSpeechRecognition?: WebSpeechCtor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

function classifyWebError(error: string): VoiceErrorReason {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'permission';
  if (error === 'no-speech') return 'no-speech';
  if (error === 'network') return 'offline';

  return 'failed';
}

/**
 * Jalan native (Android): pakai dialog pengenal suara bawaan Google lewat
 * plugin. `popup: true` + `partialResults: false` meminta hasil akhir setelah
 * pemakai selesai bicara, sehingga satu ketukan tombol = satu kali bicara.
 */
async function listenNative(): Promise<string> {
  try {
    const status = await SpeechRecognition.checkPermissions();
    if (status.speechRecognition !== 'granted') {
      const asked = await SpeechRecognition.requestPermissions();
      if (asked.speechRecognition !== 'granted') throw new VoiceError('permission');
    }

    const { matches } = await SpeechRecognition.start({
      language: LANGUAGE,
      maxResults: MAX_RESULTS,
      prompt: PROMPT,
      partialResults: false,
      popup: true,
    });

    const text = pickMatch(matches ?? []);
    if (text === null) throw new VoiceError('no-speech');

    return text;
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw new VoiceError(classifyNativeError(error));
  }
}

/**
 * Jalan peramban (hanya untuk pengembangan lewat `npm run dev`; WebView Android
 * tidak menyediakan Web Speech API, di sana yang dipakai plugin native).
 */
function listenWeb(): Promise<string> {
  const Ctor = webSpeechCtor();
  if (!Ctor) return Promise.reject(new VoiceError('unsupported'));

  return new Promise<string>((resolve, reject) => {
    const recognition = new Ctor();
    recognition.lang = LANGUAGE;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = MAX_RESULTS;

    let settled = false;
    const done = (finish: () => void) => {
      if (settled) return;
      settled = true;
      finish();
    };

    recognition.onresult = (event) => {
      const alternatives: string[] = [];
      const result = event.results[0];

      for (let index = 0; index < result.length; index += 1) {
        alternatives.push(result[index].transcript);
      }

      const text = pickMatch(alternatives);
      done(() => (text === null ? reject(new VoiceError('no-speech')) : resolve(text)));
    };

    recognition.onerror = (event) => {
      const reason = classifyWebError(event.error);
      done(() => reject(new VoiceError(reason)));
    };

    // Peramban menutup sesinya sendiri begitu pemakai berhenti bicara.
    recognition.onend = () => done(() => reject(new VoiceError('no-speech')));

    try {
      recognition.start();
    } catch {
      done(() => reject(new VoiceError('failed')));
    }
  });
}

/**
 * Pengenal suara untuk kolom pencarian (PLAN.md §4.4).
 *
 * Tugasnya hanya mengubah ucapan menjadi teks pencarian; mencari produknya
 * tetap lewat API yang sama dengan pencarian ketik, jadi daftar dan harga tetap
 * datang dari server.
 */
export const voiceService = {
  listen(): Promise<string> {
    return Capacitor.isNativePlatform() ? listenNative() : listenWeb();
  },
};
