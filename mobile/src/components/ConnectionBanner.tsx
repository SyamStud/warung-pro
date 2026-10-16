import { IonIcon } from '@ionic/react';
import { cloudOfflineOutline } from 'ionicons/icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Persistent banner shown while the device has no connection, so users
 * understand why data may be stale and why saving is disabled.
 */
const ConnectionBanner: React.FC = () => {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--app-amber-soft)',
        color: 'var(--app-amber)',
        fontSize: 11.7,
        fontWeight: 600,
        padding: '10px 16px',
      }}
    >
      <IonIcon icon={cloudOfflineOutline} aria-hidden="true" style={{ fontSize: 16.2 }} />
      <span>Offline — data mungkin tidak terbaru dan perubahan disimpan untuk disinkron nanti.</span>
    </div>
  );
};

export default ConnectionBanner;
