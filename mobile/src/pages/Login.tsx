import { useState } from 'react';
import { IonContent, IonIcon, IonPage, IonSpinner, useIonAlert } from '@ionic/react';
import { eyeOffOutline, eyeOutline, lockClosedOutline, storefrontOutline } from 'ionicons/icons';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../lib/http';

/** 2 · Login — email + password, with the mockup's helper links. */
const Login: React.FC = () => {
  const { login } = useAuth();
  const [presentAlert] = useIonAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const unavailable = (title: string) =>
    presentAlert({
      header: title,
      message:
        'Fitur ini belum tersedia di versi MVP. Hubungi pemilik akun untuk mengatur akses.',
      buttons: ['OK'],
    });

  return (
    <IonPage>
      <IonContent>
        <div className="screen" style={{ paddingTop: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                background: 'var(--app-blue)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 34,
                margin: '0 auto 14px',
                boxShadow: '0 12px 26px rgba(37,99,235,.28)',
              }}
            >
              <IonIcon icon={storefrontOutline} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Masuk</h1>
            <p style={{ color: 'var(--app-muted)', fontSize: 14, margin: 0 }}>
              Masuk untuk mulai berjualan
            </p>
          </div>

          <form className="card" onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Email</span>
              <div className="field__row">
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@warung.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="field">
              <span className="field__label">Kata sandi</span>
              <div className="field__row">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                </button>
              </div>
            </label>

            {error && <p className="note note--error">{error}</p>}

            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : 'Masuk'}
            </button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className="link"
                onClick={() => unavailable('Lupa password')}
              >
                Lupa password?
              </button>
              <span style={{ fontSize: 13, color: 'var(--app-muted)' }}>
                Belum punya akun?{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => unavailable('Daftar akun')}
                >
                  Daftar
                </button>
              </span>
            </div>
          </form>

          <p
            style={{
              textAlign: 'center',
              color: 'var(--app-faint)',
              fontSize: 12,
              marginTop: 18,
            }}
          >
            <IonIcon icon={lockClosedOutline} /> Koneksi aman ke server warung
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
