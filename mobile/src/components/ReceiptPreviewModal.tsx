import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonNote,
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
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={onDismiss}>Tutup</IonButton>
        </IonButtons>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent className="ion-padding">
      <IonNote color="medium" className="ion-display-block ion-padding-bottom">
        Pratinjau struk (lebar kertas mengikuti pengaturan printer).
      </IonNote>
      <pre
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.25,
          whiteSpace: 'pre',
          overflowX: 'auto',
          background: 'var(--ion-color-light)',
          padding: 12,
          borderRadius: 8,
        }}
      >
        {text}
      </pre>
    </IonContent>
  </IonModal>
);

export default ReceiptPreviewModal;
