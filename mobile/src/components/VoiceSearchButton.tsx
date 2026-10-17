import { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { micOutline } from 'ionicons/icons';
import { VoiceError, voiceService } from '../services/voice';

interface VoiceSearchButtonProps {
  disabled?: boolean;
  /** `inline` = kecil di dalam kolom pencarian; `circle` = bulat besar di bawah viewfinder. */
  variant?: 'inline' | 'circle';
  /** Nama tombol untuk pembaca layar. */
  label?: string;
  /** Teks hasil ucapan, sudah bersih dari kata perintah ("cari", "harga", …). */
  onResult: (text: string) => void;
  onError: (error: VoiceError) => void;
}

/**
 * Tombol mikrofon pencarian suara.
 *
 * Sekali ketuk = sekali bicara: pengenal suara menutup sendiri setelah pemakai
 * berhenti, lalu teksnya dikembalikan ke halaman. Halaman yang mengisi kolom
 * pencarian, sehingga pencarian suara dan pencarian ketik menempuh jalur yang
 * sama persis.
 *
 * Halaman Cek Harga memakai dua-duanya: yang kecil menemani ibu jari yang
 * sedang mengetik, yang bulat besar di bawah viewfinder supaya bisa ditekan
 * tanpa mengarahkan pandangan.
 */
const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  disabled = false,
  variant = 'inline',
  label = 'Cari dengan suara',
  onResult,
  onError,
}) => {
  const [listening, setListening] = useState(false);

  const listen = async () => {
    if (listening) return;
    setListening(true);

    try {
      onResult(await voiceService.listen());
    } catch (error) {
      onError(error instanceof VoiceError ? error : new VoiceError('failed'));
    } finally {
      setListening(false);
    }
  };

  const className =
    variant === 'circle'
      ? `voice-fab__btn${listening ? ' voice-fab__btn--on' : ''}`
      : `search__voice${listening ? ' search__voice--on' : ''}`;

  return (
    <button
      type="button"
      className={className}
      aria-label={listening ? `${label} — sedang mendengarkan` : label}
      aria-busy={listening}
      disabled={disabled || listening}
      onClick={() => void listen()}
    >
      {listening ? <IonSpinner name="crescent" /> : <IonIcon icon={micOutline} />}
    </button>
  );
};

export default VoiceSearchButton;
