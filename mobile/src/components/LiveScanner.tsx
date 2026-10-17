import { useEffect, useRef, useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  cameraOutline,
  closeCircle,
  flashOutline,
  refreshOutline,
  scanOutline,
  sparklesOutline,
  videocamOffOutline,
} from 'ionicons/icons';
import { ScannerError, scannerService } from '../services/scanner';
import { playScanBeep, primeBeep } from '../lib/beep';
import {
  Candidate,
  confirmCandidate,
  decodeCanvas,
  frameToVideoRoi,
  FrameReader,
} from '../lib/scanFrame';

type PreviewState = 'off' | 'starting' | 'live' | 'blocked' | 'unavailable';

interface LiveScannerProps {
  /** The preview runs only while true — the page turns it off before opening ML Kit. */
  active: boolean;
  /** The user pressed the on/off control inside the viewfinder. */
  onToggle: () => void;
  /** A barcode the decoder trusts. May fire again for a code after `rearmKey` changes. */
  onDetected: (value: string) => void;
  /**
   * Bump this to forget the codes already reported (e.g. the user asked to scan
   * again after "kode tidak ditemukan"). The camera keeps running, so recovery
   * costs no restart.
   */
  rearmKey?: number;
}

/**
 * Retail 1D codes only.
 *
 * Every one of them carries a checksum, so a noisy frame cannot invent a code
 * (CODE_39/ITF were the ones that could — they are gone). Leaving out the 2D
 * formats also skips the expensive QR/DataMatrix detectors, which is what made
 * each attempt slow. 2D codes stay available through the ML Kit button.
 */
const FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'] as const;

/** Target pause between attempts (each attempt is skipped while one is running). */
const ATTEMPT_INTERVAL_MS = 110;

type Zxing = typeof import('@zxing/library');

/** Torch and focus mode exist in Chrome/WebView but not in the DOM typings. */
type ExtendedCapabilities = MediaTrackCapabilities & { torch?: boolean };
type ExtendedConstraintSet = MediaTrackConstraintSet & { focusMode?: string; torch?: boolean };
type ExtendedConstraints = MediaTrackConstraints & { advanced?: ExtendedConstraintSet[] };

/**
 * Live viewfinder for Cek Harga: streams the camera inside the app (WebView
 * `getUserMedia`) and decodes the framed area with zxing, loaded on demand so
 * it stays out of the main bundle. The native ML Kit scanner remains the second
 * way to scan and is always reachable, so every failure here degrades to a
 * message plus that button instead of a dead end.
 */
const LiveScanner: React.FC<LiveScannerProps> = ({ active, onToggle, onDetected, rearmKey = 0 }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const readerRef = useRef<FrameReader | null>(null);
  const timerRef = useRef<number | null>(null);
  const reportedRef = useRef<Set<string>>(new Set());
  const candidateRef = useRef<Candidate | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [state, setState] = useState<PreviewState>(active ? 'starting' : 'off');
  const [message, setMessage] = useState('Menyalakan kamera…');
  const [attempt, setAttempt] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Android WebViews hold an AudioContext suspended until the first gesture;
  // unlocking it here means the very first scan already beeps.
  useEffect(() => primeBeep(), []);

  // "Pindai ulang": forget the reported codes without touching the camera.
  useEffect(() => {
    reportedRef.current = new Set();
    candidateRef.current = null;
  }, [rearmKey]);

  useEffect(() => {
    if (!active) {
      setState('off');
      setMessage('Kamera nonaktif.');
      return;
    }

    let cancelled = false;
    reportedRef.current = new Set();
    candidateRef.current = null;
    setState('starting');
    setMessage('Menyalakan kamera…');

    const stopLoop = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const releaseCamera = () => {
      stopLoop();
      readerRef.current = null;
      trackRef.current = null;
      setTorchOn(false);
      setTorchAvailable(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    /** One decode attempt per tick; a new tick is only scheduled once the last one finished. */
    const startDecoding = (zxing: Zxing) => {
      const hints = new Map<number, unknown>();
      hints.set(
        zxing.DecodeHintType.POSSIBLE_FORMATS,
        FORMATS.map((format) => zxing.BarcodeFormat[format]),
      );
      // Only checksum-protected formats are enabled, so the harder search is safe.
      hints.set(zxing.DecodeHintType.TRY_HARDER, true);

      const reader = new zxing.MultiFormatReader();
      reader.setHints(hints as Parameters<typeof reader.setHints>[0]);
      readerRef.current = reader;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (cancelled) return;
        const startedAt = performance.now();

        const element = videoRef.current;
        const frameElement = frameRef.current;
        if (element && frameElement && context && element.videoWidth > 0) {
          const roi = frameToVideoRoi(
            {
              videoWidth: element.videoWidth,
              videoHeight: element.videoHeight,
              rect: element.getBoundingClientRect(),
            },
            frameElement.getBoundingClientRect(),
          );

          if (roi) {
            try {
              canvas.width = roi.size;
              canvas.height = roi.size;
              context.drawImage(
                element,
                roi.sx,
                roi.sy,
                roi.sSize,
                roi.sSize,
                0,
                0,
                roi.size,
                roi.size,
              );

              const value = decodeCanvas(zxing, reader, canvas);

              if (value) {
                const { confirmed, candidate } = confirmCandidate(
                  candidateRef.current,
                  value,
                  Date.now(),
                );
                candidateRef.current = candidate;

                if (confirmed && !reportedRef.current.has(value)) {
                  reportedRef.current.add(value);
                  playScanBeep();
                  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
                  onDetectedRef.current(value);
                }
              }
            } catch {
              /* No barcode in this frame — the normal case most of the time. */
            }
          }
        }

        const elapsed = performance.now() - startedAt;
        timerRef.current = window.setTimeout(tick, Math.max(0, ATTEMPT_INTERVAL_MS - elapsed));
      };

      tick();
    };

    (async () => {
      try {
        await scannerService.ensureCameraPermission();
      } catch (error) {
        if (cancelled) return;
        setState('blocked');
        setMessage(error instanceof ScannerError ? error.message : 'Izin kamera tidak tersedia.');
        return;
      }

      if (cancelled) return;

      const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
      if (!media?.getUserMedia) {
        setState('unavailable');
        setMessage('Pratinjau kamera tidak tersedia di perangkat ini.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await media.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setState('blocked');
          setMessage('Izin kamera ditolak. Aktifkan izin kamera untuk memindai.');
        } else {
          setState('unavailable');
          setMessage('Kamera tidak dapat dibuka.');
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;

      // Barcode reading is much more reliable in focus. Devices that do not
      // support these constraints simply ignore them.
      try {
        await track?.applyConstraints({
          advanced: [{ focusMode: 'continuous' }],
        } as ExtendedConstraints);
      } catch {
        /* not supported — the camera keeps its own default */
      }

      // A torch button is only shown when the device really has one.
      const capabilities = (track?.getCapabilities?.() ?? null) as ExtendedCapabilities | null;
      if (!cancelled && capabilities?.torch) setTorchAvailable(true);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await Promise.resolve(video.play()).catch(() => undefined);
      }
      if (cancelled) {
        releaseCamera();
        return;
      }
      setState('live');

      try {
        const zxing = await import('@zxing/library');
        if (cancelled) return;
        startDecoding(zxing);
      } catch {
        if (cancelled) return;
        setState('unavailable');
        setMessage('Pemindai otomatis tidak dapat dijalankan.');
      }
    })();

    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, [active, attempt]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;

    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as ExtendedConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  const caption =
    state === 'live'
      ? 'Arahkan barcode ke dalam bingkai — harga muncul otomatis'
      : 'Pakai tombol Pindai Barcode di bawah bila kamera tidak aktif';

  const failed = state === 'blocked' || state === 'unavailable';

  return (
    <>
      <div className="viewfinder">
        <video
          ref={videoRef}
          className="viewfinder__video"
          playsInline
          muted
          autoPlay
          style={{ visibility: state === 'live' ? 'visible' : 'hidden' }}
        />

        <span className="badge badge--blue viewfinder__badge">
          <IonIcon icon={state === 'live' ? scanOutline : sparklesOutline} />
          {state === 'live' ? 'Pindai otomatis' : 'Mode pindai'}
        </span>

        {state === 'live' ? (
          <div className="viewfinder__overlay">
            <div className="viewfinder__frame" ref={frameRef}>
              <span className="viewfinder__laser" />
            </div>
          </div>
        ) : (
          <div className="viewfinder__state" role="status">
            {state === 'starting' ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon className="viewfinder__state-icon" icon={videocamOffOutline} />
            )}
            <span>{message}</span>
          </div>
        )}

        {state === 'live' && torchAvailable && (
          <button
            type="button"
            className="viewfinder__control viewfinder__control--torch"
            aria-label={torchOn ? 'Matikan lampu' : 'Nyalakan lampu'}
            aria-pressed={torchOn}
            onClick={() => void toggleTorch()}
          >
            <IonIcon icon={flashOutline} />
            {torchOn ? 'Lampu mati' : 'Lampu'}
          </button>
        )}

        <button
          type="button"
          className="viewfinder__control"
          aria-label={
            failed ? 'Coba nyalakan kamera lagi' : active ? 'Matikan kamera' : 'Nyalakan kamera'
          }
          onClick={failed ? () => setAttempt((value) => value + 1) : onToggle}
        >
          {failed ? (
            <>
              <IonIcon icon={refreshOutline} /> Coba lagi
            </>
          ) : (
            <>
              <IonIcon icon={active ? closeCircle : cameraOutline} />
              {active ? 'Matikan' : 'Nyalakan'}
            </>
          )}
        </button>
      </div>

      <p className="viewfinder__caption">{caption}</p>
    </>
  );
};

export default LiveScanner;
