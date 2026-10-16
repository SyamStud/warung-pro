import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';

/** Ionic takes the content background through a custom property. */
const splashBackground = {
  '--background': 'linear-gradient(165deg, #2563eb 0%, #1d4ed8 55%, #1638a8 100%)',
} as React.CSSProperties;

/** 1 · Splash — the branded entry screen shown before login. */
const Splash: React.FC = () => {
  const navigate = useNavigate();

  return (
    <IonPage>
      <IonContent style={splashBackground}>
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 28px 36px',
            textAlign: 'center',
          }}
        >
          <div
            className="card"
            style={{
              borderRadius: 32,
              padding: 22,
              width: '100%',
              maxWidth: 320,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <StoreIllustration />
          </div>

          <h1
            style={{
              color: '#fff',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '26px 0 6px',
            }}
          >
            Warung
          </h1>
          <p style={{ color: 'rgba(255,255,255,.86)', fontSize: 14.5, margin: 0 }}>
            Cek harga &amp; kasir untuk warung kamu
          </p>

          <div style={{ flex: 1, minHeight: 28 }} />

          <button
            type="button"
            className="btn"
            style={{ background: '#fff', color: 'var(--app-blue-dark)', maxWidth: 320 }}
            onClick={() => navigate('/login')}
          >
            Mulai
          </button>
          <p
            style={{
              color: 'rgba(255,255,255,.7)',
              fontSize: 12,
              margin: '14px 0 0',
            }}
          >
            Harga &amp; total dihitung oleh server
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

/** Inline storefront mark — the app ships no image assets. */
function StoreIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      width="196"
      height="196"
      role="img"
      aria-label="Ilustrasi warung"
    >
      <circle cx="100" cy="100" r="86" fill="#eaf1ff" />

      {/* Awning */}
      <path d="M30 78h140l-9-24a9 9 0 0 0-8.5-6H47.5A9 9 0 0 0 39 54z" fill="#1d4ed8" />
      <path d="M52 48h16l-4 30H48z" fill="#2563eb" />
      <path d="M92 48h16l-4 30H88z" fill="#2563eb" />
      <path d="M132 48h16l-4 30h-16z" fill="#2563eb" />

      {/* Body */}
      <rect x="34" y="78" width="132" height="94" rx="12" fill="#ffffff" />
      <rect x="34" y="78" width="132" height="94" rx="12" fill="none" stroke="#dbe4f5" />

      {/* Door */}
      <rect x="86" y="118" width="30" height="54" rx="8" fill="#2563eb" />
      <circle cx="110" cy="146" r="2.6" fill="#fff" />

      {/* Windows */}
      <rect x="48" y="112" width="28" height="26" rx="7" fill="#dbeafe" />
      <rect x="126" y="112" width="28" height="26" rx="7" fill="#dbeafe" />

      {/* Price tag */}
      <g transform="rotate(-18 156 44)">
        <rect x="130" y="22" width="52" height="34" rx="9" fill="#16a34a" />
        <circle cx="140" cy="39" r="3.4" fill="#e7f8ee" />
        <text
          x="158"
          y="44"
          fontSize="15"
          fontWeight="700"
          fill="#ffffff"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          Rp
        </text>
      </g>
    </svg>
  );
}

export default Splash;
