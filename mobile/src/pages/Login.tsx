import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../lib/http';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Masuk</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={onSubmit}>
          <IonList>
            <IonItem>
              <IonInput
                label="Email"
                labelPlacement="stacked"
                type="email"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? '')}
                autocomplete="email"
                required
              />
            </IonItem>
            <IonItem>
              <IonInput
                label="Kata sandi"
                labelPlacement="stacked"
                type="password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
                autocomplete="current-password"
                required
              />
            </IonItem>
          </IonList>

          {error && (
            <IonNote color="danger" className="ion-padding-vertical ion-display-block">
              {error}
            </IonNote>
          )}

          <IonButton type="submit" expand="block" disabled={submitting}>
            {submitting ? <IonSpinner name="dots" /> : 'Masuk'}
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
};

export default Login;
