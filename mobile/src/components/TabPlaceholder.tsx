import { IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import ConnectionBanner from './ConnectionBanner';

interface TabPlaceholderProps {
  title: string;
  /** What this screen will do once its phase lands (see PLAN.md §4). */
  description: string;
}

/** Temporary screen body for tabs whose features arrive in later phases. */
const TabPlaceholder: React.FC<TabPlaceholderProps> = ({ title, description }) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <ConnectionBanner />
      <IonText color="medium">
        <p>{description}</p>
      </IonText>
    </IonContent>
  </IonPage>
);

export default TabPlaceholder;
