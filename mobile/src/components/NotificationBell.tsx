import { IonIcon } from '@ionic/react';
import { notificationsOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

/**
 * Lonceng di baris sapaan Beranda: membuka halaman Notifikasi dan menandai
 * dengan titik kecil kalau ada kabar yang belum dibuka.
 */
const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { unread } = useNotifications();

  return (
    <button
      type="button"
      className="notif-bell"
      aria-label={unread > 0 ? `Notifikasi, ${unread} baru` : 'Notifikasi'}
      onClick={() => navigate('/tabs/notifications')}
    >
      <IonIcon icon={notificationsOutline} aria-hidden="true" />
      {unread > 0 && <span className="notif-bell__dot" aria-hidden="true" />}
    </button>
  );
};

export default NotificationBell;
