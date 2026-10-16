import { useState } from 'react';
import { IonBadge, IonButton, IonIcon, IonSpinner, useIonAlert } from '@ionic/react';
import { cloudUploadOutline } from 'ionicons/icons';
import ConflictResolutionModal from './ConflictResolutionModal';
import { useOutbox } from '../hooks/useOutbox';

/**
 * Header indicator for the offline queue: how many changes are waiting, failed
 * or blocked by a conflict, with actions to retry, discard or resolve them.
 */
const SyncStatus: React.FC = () => {
  const {
    pendingCount,
    failedCount,
    conflictCount,
    conflicts,
    isFlushing,
    retryFailed,
    discardFailed,
    resolveKeepServer,
    resolveKeepMine,
  } = useOutbox();
  const [presentAlert] = useIonAlert();
  const [conflictsOpen, setConflictsOpen] = useState(false);

  const total = pendingCount + failedCount + conflictCount;
  if (total === 0 && !isFlushing) return null;

  const open = () => {
    presentAlert({
      header: 'Sinkronisasi',
      message: [
        `${pendingCount} perubahan menunggu.`,
        conflictCount > 0 ? `${conflictCount} bentrok dengan perangkat lain.` : null,
        failedCount > 0 ? `${failedCount} gagal disinkronkan.` : null,
      ]
        .filter(Boolean)
        .join(' '),
      buttons: [
        { text: 'Tutup', role: 'cancel' },
        ...(conflictCount > 0
          ? [
              {
                text: 'Tinjau bentrok',
                handler: () => {
                  setConflictsOpen(true);
                },
              },
            ]
          : []),
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
        ...(failedCount > 0
          ? [
              {
                text: 'Coba lagi',
                handler: () => {
                  void retryFailed();
                },
              },
            ]
          : []),
      ],
    });
  };

  return (
    <>
      <IonButton onClick={open} aria-label="Status sinkronisasi">
        {isFlushing ? (
          <IonSpinner name="dots" />
        ) : (
          <>
            <IonIcon slot="start" icon={cloudUploadOutline} />
            <IonBadge color={conflictCount > 0 || failedCount > 0 ? 'danger' : 'warning'}>
              {total}
            </IonBadge>
          </>
        )}
      </IonButton>

      <ConflictResolutionModal
        isOpen={conflictsOpen}
        conflicts={conflicts}
        onDismiss={() => setConflictsOpen(false)}
        onKeepServer={(id) => {
          void resolveKeepServer(id);
        }}
        onKeepMine={(id) => {
          void resolveKeepMine(id);
        }}
      />
    </>
  );
};

export default SyncStatus;
