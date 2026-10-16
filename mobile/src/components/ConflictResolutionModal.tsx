import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { ProductConflict } from '../lib/offline/conflicts';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ProductConflict[];
  onDismiss: () => void;
  /** Discard this device's edit and keep the server's version. */
  onKeepServer: (itemId: string) => void;
  /** Overwrite the server's version with this device's edit. */
  onKeepMine: (itemId: string) => void;
}

/**
 * Side-by-side comparison of a product edited on two devices, with an explicit
 * choice per conflict. Nothing is overwritten until the user decides.
 */
const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflicts,
  onDismiss,
  onKeepServer,
  onKeepMine,
}) => (
  <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Perubahan Bentrok</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={onDismiss}>Tutup</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div className="ion-padding">
        Produk berikut diubah di perangkat lain setelah Anda membuka formulir.
        Pilih versi mana yang ingin disimpan.
      </div>

      {conflicts.map((conflict) => (
        <IonList key={conflict.itemId}>
          <IonItem lines="none">
            <IonLabel>
              <h2>{conflict.title}</h2>
              <p>Produk #{conflict.productId}</p>
            </IonLabel>
          </IonItem>

          {conflict.fields.length === 0 ? (
            <IonItem>
              <IonLabel>
                <p>Nilai sudah sama dengan server. Tidak ada yang perlu dipilih.</p>
              </IonLabel>
            </IonItem>
          ) : (
            conflict.fields.map((field) => (
              <IonItem key={field.key}>
                <IonLabel>
                  <h3>{field.label}</h3>
                  <p>Saya: {field.mine}</p>
                  <p>Server: {field.server}</p>
                </IonLabel>
              </IonItem>
            ))
          )}

          <IonItem lines="none">
            <IonButton size="small" fill="outline" onClick={() => onKeepServer(conflict.itemId)}>
              Pakai versi server
            </IonButton>
            <IonButton size="small" color="warning" onClick={() => onKeepMine(conflict.itemId)}>
              Simpan milik saya
            </IonButton>
          </IonItem>
        </IonList>
      ))}
    </IonContent>
  </IonModal>
);

export default ConflictResolutionModal;
