import { useEffect, useState } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables + the shared UI kit */
import './theme/variables.css';
import './theme/app.css';

import { useAuth } from './auth/useAuth';
import { CartProvider } from './cart/CartProvider';
import { ShareInboxProvider } from './share/ShareInboxProvider';
import HeadlessPrint from './headless/HeadlessPrint';
import { isHeadlessLaunch } from './services/shareTarget';
import Login from './pages/Login';
import Splash from './pages/Splash';
import Tabs from './pages/Tabs';

setupIonicReact();

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [headless, setHeadless] = useState<boolean | null>(null);

  // A share opens the app in a hidden window. Detect that before anything else
  // so the silent print flow never waits for the session or shows the router.
  useEffect(() => {
    let alive = true;

    void isHeadlessLaunch().then((value) => {
      if (alive) setHeadless(value);
    });

    return () => {
      alive = false;
    };
  }, []);

  if (headless === null) {
    // Nothing is drawn while the native side answers; the window is invisible
    // anyway, so any placeholder would only waste a render.
    return <IonApp />;
  }

  if (headless) {
    return (
      <IonApp>
        <HeadlessPrint />
      </IonApp>
    );
  }

  // Session bootstrap — avoid flashing the login screen while the token is
  // being resolved against `/me`.
  if (isLoading) {
    return (
      <IonApp>
        <div className="spinner-center" style={{ height: '100%' }}>
          <IonSpinner name="crescent" />
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <CartProvider>
        <ShareInboxProvider>
          <IonReactRouter>
            <IonRouterOutlet>
              <Route
                path="/splash"
                element={isAuthenticated ? <Navigate to="/tabs/home" replace /> : <Splash />}
              />
              <Route
                path="/login"
                element={isAuthenticated ? <Navigate to="/tabs/home" replace /> : <Login />}
              />
              <Route
                path="/tabs/*"
                element={isAuthenticated ? <Tabs /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/"
                element={<Navigate to={isAuthenticated ? '/tabs/home' : '/splash'} replace />}
              />
            </IonRouterOutlet>
          </IonReactRouter>
        </ShareInboxProvider>
      </CartProvider>
    </IonApp>
  );
};

export default App;
