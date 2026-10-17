import { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { micOutline } from 'ionicons/icons';
import { VoiceError, voiceService } from '../services/voice';

interface VoiceSearchButtonProps {
  disabled?: boolean;
  /** Teks hasil ucapan, sudah bersih dari kata perintah ("cari", "harga", …). */
  onResult: (text: string) => void;
  onError: (error: VoiceError) => void;
}

/**
 * Tombol mikrofon di dalam kolom pencarian Cek Harga.
 *
 * Sekali ketuk = sekali bicara: pengenal suara menutup sendiri setelah pemakai
 * berhenti, lalu teksnya dikembalikan ke halaman. Halaman yang mengisi kolom
 * pencarian, sehingga pencarian suara dan pencarian ketik menempuh jalur yang
 * sama persis.
 */
const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  disabled = false,
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

  return (
    <button
      type="button"
      className={`search__voice${listening ? ' search__voice--on' : ''}`}
      aria-label={listening ? 'Mendengarkan, sebutkan nama produk' : 'Cari dengan suara'}
      aria-busy={listening}
      disabled={disabled || listening}
      onClick={() => void listen()}
    >
      {listening ? <IonSpinner name="crescent" /> : <IonIcon icon={micOutline} />}
    </button>
  );
};

export default VoiceSearchButton;
