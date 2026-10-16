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
      className="ion-padding-horizontal ion-padding-vertical"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--ion-color-warning)',
        color: 'var(--ion-color-warning-contrast)',
        fontSize: 14,
      }}
    >
      <IonIcon icon={cloudOfflineOutline} aria-hidden="true" />
      <span>Offline — data mungkin tidak terbaru dan perubahan tidak dapat disimpan.</span>
    </div>
  );
};

export default ConnectionBanner;
