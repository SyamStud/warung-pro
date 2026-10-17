import { IonIcon } from '@ionic/react';
import { downloadOutline, sparklesOutline } from 'ionicons/icons';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { formatBytes } from '../lib/format';

/**
 * "Versi baru tersedia" notice on Beranda, shown when the server publishes a
 * build newer than the installed one. "Nanti" hides that build until an even
 * newer one appears.
 *
 * The button is a plain link on purpose: inside the Android WebView, Capacitor
 * hands any foreign URL to the system browser, so Chrome downloads the APK and
 * offers to install it — no extra plugin and no "install unknown apps" prompt
 * for the app itself.
 */
const UpdateBanner: React.FC = () => {
  const { release, dismiss } = useAppUpdate();

  if (release === null) return null;

  const size = formatBytes(release.size_bytes);

  return (
    <div className="update-banner" role="status">
      <IonIcon className="update-banner__icon" icon={sparklesOutline} aria-hidden="true" />

      <div className="update-banner__body">
        <p className="update-banner__title">Versi {release.version_name} tersedia</p>
        {release.notes && <p className="update-banner__notes">{release.notes}</p>}
        <p className="update-banner__meta">
          {size ? `Ukuran ${size} · ` : ''}Unduh lalu pasang untuk memakai versi terbaru.
        </p>
      </div>

      <div className="update-banner__actions">
        <a className="btn btn--primary btn--sm" href={release.download_url}>
          <IonIcon icon={downloadOutline} aria-hidden="true" /> Perbarui
        </a>
        <button type="button" className="btn btn--plain btn--sm" onClick={dismiss}>
          Nanti
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
