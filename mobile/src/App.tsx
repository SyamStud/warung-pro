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
import Login from './pages/Login';
import Splash from './pages/Splash';
import Tabs from './pages/Tabs';

setupIonicReact();

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

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
      </CartProvider>
    </IonApp>
  );
};

export default App;
