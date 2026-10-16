import { IonBadge, IonButton, IonIcon, IonSpinner, useIonAlert } from '@ionic/react';
import { cloudUploadOutline } from 'ionicons/icons';
import { useOutbox } from '../hooks/useOutbox';

/**
 * Header indicator for the offline queue: shows how many changes are waiting
 * (and how many failed), with actions to retry or discard.
 */
const SyncStatus: React.FC = () => {
  const { pendingCount, failedCount, isFlushing, retryFailed, discardFailed } = useOutbox();
  const [presentAlert] = useIonAlert();

  const total = pendingCount + failedCount;
  if (total === 0 && !isFlushing) return null;

  const open = () => {
    presentAlert({
      header: 'Sinkronisasi',
      message:
        failedCount > 0
          ? `${pendingCount} perubahan menunggu, ${failedCount} gagal disinkronkan.`
          : `${pendingCount} perubahan menunggu untuk disinkronkan.`,
      buttons: [
        { text: 'Tutup', role: 'cancel' },
        ...(failedCount > 0
          ? [
              {
                text: 'Buang yang gagal',
                role: 'destructive' as const,
                handler: () => {
                  void discardFailed();
                },
              },
            ]
          : []),
        {
          text: 'Coba lagi',
          handler: () => {
            void retryFailed();
          },
        },
      ],
    });
  };

  return (
    <IonButton onClick={open} aria-label="Status sinkronisasi">
      {isFlushing ? (
        <IonSpinner name="dots" />
      ) : (
        <>
          <IonIcon slot="start" icon={cloudUploadOutline} />
          <IonBadge color={failedCount > 0 ? 'danger' : 'warning'}>{total}</IonBadge>
        </>
      )}
    </IonButton>
  );
};

export default SyncStatus;
