import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
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
    <IonHeader className="app-header">
      <IonToolbar>
        <IonTitle className="app-title-bar">Perubahan Bentrok</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={onDismiss}>Tutup</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div className="screen">
        <p className="note note--warn">
          Produk berikut diubah di perangkat lain setelah Anda membuka formulir. Pilih versi mana
          yang ingin disimpan.
        </p>

        {conflicts.map((conflict) => (
          <div key={conflict.itemId} className="card" style={{ marginBottom: 12 }}>
            <div className="card__head" style={{ marginBottom: 6 }}>
              <h2 className="card__title">{conflict.title}</h2>
              <span className="badge badge--grey">#{conflict.productId}</span>
            </div>

            {conflict.fields.length === 0 ? (
              <p className="field__hint">Nilai sudah sama dengan server. Tidak ada yang perlu dipilih.</p>
            ) : (
              conflict.fields.map((field) => (
                <div key={field.key} style={{ marginBottom: 10 }}>
                  <p className="field__label" style={{ marginBottom: 4 }}>
                    {field.label}
                  </p>
                  <div className="field__row" style={{ gap: 8 }}>
                    <span className="badge badge--blue" style={{ flex: 1, justifyContent: 'center' }}>
                      Saya: {field.mine}
                    </span>
                    <span
                      className="badge badge--grey"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Server: {field.server}
                    </span>
                  </div>
                </div>
              ))
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => onKeepServer(conflict.itemId)}
              >
                Pakai versi server
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => onKeepMine(conflict.itemId)}
              >
                Simpan milik saya
              </button>
            </div>
          </div>
        ))}
      </div>
    </IonContent>
  </IonModal>
);

export default ConflictResolutionModal;
