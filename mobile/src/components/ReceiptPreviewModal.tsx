import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  title: string;
  text: string;
  onDismiss: () => void;
}

/** Shows the receipt as monospaced text — used on web and as a fallback. */
const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  title,
  text,
  onDismiss,
}) => (
  <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
    <IonHeader className="app-header">
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={onDismiss}>Tutup</IonButton>
        </IonButtons>
        <IonTitle className="app-title-bar">{title}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div className="screen">
        <p className="field__hint" style={{ marginBottom: 12 }}>
          Teks ini dikirim apa adanya ke printer (lebar kertas mengikuti pengaturan).
        </p>
        <pre className="receipt-card__mono">{text}</pre>
      </div>
    </IonContent>
  </IonModal>
);

export default ReceiptPreviewModal;
