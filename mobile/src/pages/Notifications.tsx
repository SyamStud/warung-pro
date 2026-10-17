import { useEffect } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { downloadOutline, sparklesOutline } from 'ionicons/icons';
import PageHeader from '../components/PageHeader';
import { useNotifications, type NotificationItem } from '../hooks/useNotifications';

const NotificationCard: React.FC<NotificationItem> = ({ title, body, meta, action, dismiss }) => (
  <article className="notif-card">
    <span className="notif-card__icon" aria-hidden="true">
      <IonIcon icon={sparklesOutline} />
    </span>

    <div className="notif-card__body">
      <p className="notif-card__title">{title}</p>
      {body && <p className="notif-card__text">{body}</p>}
      {meta && <p className="notif-card__meta">{meta}</p>}

      <div className="notif-card__actions">
        {action && (
          <a className="btn btn--primary btn--sm" href={action.href}>
            <IonIcon icon={downloadOutline} aria-hidden="true" /> {action.label}
          </a>
        )}
        {dismiss && (
          <button type="button" className="btn btn--plain btn--sm" onClick={dismiss}>
            Nanti
          </button>
        )}
      </div>
    </div>
  </article>
);

/**
 * Notifikasi — daftar kabar aplikasi, dibuka dari lonceng di Beranda.
 *
 * Membuka halaman ini berarti "sudah dibaca" (titik di lonceng hilang), tetapi
 * kabarnya tetap ada sampai dijawab: "Perbarui" atau "Nanti".
 */
const Notifications: React.FC = () => {
  const { items, markAllSeen } = useNotifications();

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Notifikasi" backHref="/tabs/home" />

        <div className="screen">
          {items.length === 0 ? (
            <div className="card empty-state">
              <p className="empty-state__title">Belum ada notifikasi</p>
              <p className="empty-state__text">
                Kabar versi baru aplikasi akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="list-stack">
              {items.map((item) => (
                <NotificationCard key={item.id} {...item} />
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Notifications;
