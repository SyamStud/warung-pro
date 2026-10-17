import { useEffect, useRef, useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  cameraOutline,
  closeCircle,
  refreshOutline,
  scanOutline,
  sparklesOutline,
  videocamOffOutline,
} from 'ionicons/icons';
import { ScannerError, scannerService } from '../services/scanner';
import { playScanBeep, primeBeep } from '../lib/beep';

type PreviewState = 'off' | 'starting' | 'live' | 'blocked' | 'unavailable';

interface LiveScannerProps {
  /** The preview runs only while true — the page turns it off before opening ML Kit. */
  active: boolean;
  /** The user pressed the on/off control inside the viewfinder. */
  onToggle: () => void;
  /** First barcode decoded by the in-app camera. */
  onDetected: (value: string) => void;
}

/**
 * Barcode formats a warung actually meets: the 1D retail codes plus the common
 * 2D ones. Restricting the list keeps the JavaScript decoder fast enough to run
 * inside the WebView.
 */
const FORMATS = [
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'ITF',
  'QR_CODE',
  'DATA_MATRIX',
] as const;

/**
 * Live viewfinder for Cek Harga: streams the camera inside the app (WebView
 * `getUserMedia`) and decodes frames with zxing, loaded on demand so it stays
 * out of the main bundle. The native ML Kit scanner remains the second way to
 * scan and is always reachable, so every failure here degrades to a message
 * plus that button instead of a dead end.
 */
const LiveScanner: React.FC<LiveScannerProps> = ({ active, onToggle, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<{ stopContinuousDecode: () => void } | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [state, setState] = useState<PreviewState>(active ? 'starting' : 'off');
  const [message, setMessage] = useState('Menyalakan kamera…');
  const [attempt, setAttempt] = useState(0);

  // Android WebViews hold an AudioContext suspended until the first gesture;
  // unlocking it here means the very first scan already beeps.
  useEffect(() => primeBeep(), []);

  useEffect(() => {
    if (!active) {
      setState('off');
      setMessage('Kamera nonaktif.');
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setState('starting');
    setMessage('Menyalakan kamera…');

    const releaseCamera = () => {
      readerRef.current?.stopContinuousDecode();
      readerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
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

        const hints = new Map();
        hints.set(
          zxing.DecodeHintType.POSSIBLE_FORMATS,
          FORMATS.map((format) => zxing.BarcodeFormat[format]),
        );

        const reader = new zxing.BrowserMultiFormatReader(hints, 250);
        readerRef.current = reader;

        // Resolves only when the loop stops, so it is deliberately not awaited.
        void reader
          .decodeFromStream(stream, video as HTMLVideoElement, (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            playScanBeep();
            void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
            onDetectedRef.current(result.getText());
          })
          .catch(() => undefined);
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
            <div className="viewfinder__frame">
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
