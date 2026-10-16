import { Navigate, Route, useLocation } from 'react-router-dom';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { cartOutline, homeOutline, listOutline, receiptOutline } from 'ionicons/icons';
import Home from './Home';
import Products from './Products';
import Pos from './Pos';
import History from './History';
import PriceChecker from './PriceChecker';
import Payment from './Payment';
import Receipt from './Receipt';

/** Pushed pages: full screens with no bottom tab bar. */
const PUSHED_PATHS = ['/tabs/check', '/tabs/payment', '/tabs/receipt'];

/**
 * Bottom tab shell: Beranda · Produk · POS · Riwayat.
 *
 * Cek Harga, Pembayaran and Preview Struk are pushed pages — they live in the
 * same outlet but have no tab button, so the tab bar is hidden for them.
 */
const Tabs: React.FC = () => {
  const { pathname } = useLocation();
  const showTabBar = !PUSHED_PATHS.some((path) => pathname.startsWith(path));

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/home" element={<Home />} />
        <Route path="/tabs/products" element={<Products />} />
        <Route path="/tabs/pos" element={<Pos />} />
        <Route path="/tabs/history" element={<History />} />

        <Route path="/tabs/check" element={<PriceChecker />} />
        <Route path="/tabs/payment" element={<Payment />} />
        <Route path="/tabs/receipt" element={<Receipt />} />

        <Route path="/tabs" element={<Navigate to="/tabs/home" replace />} />
      </IonRouterOutlet>

      {showTabBar && (
        <IonTabBar slot="bottom" className="app-tabbar">
          <IonTabButton tab="home" href="/tabs/home">
            <IonIcon aria-hidden="true" icon={homeOutline} />
            <IonLabel>Beranda</IonLabel>
          </IonTabButton>
          <IonTabButton tab="products" href="/tabs/products">
            <IonIcon aria-hidden="true" icon={listOutline} />
            <IonLabel>Produk</IonLabel>
          </IonTabButton>
          <IonTabButton tab="pos" href="/tabs/pos">
            <IonIcon aria-hidden="true" icon={cartOutline} />
            <IonLabel>POS</IonLabel>
          </IonTabButton>
          <IonTabButton tab="history" href="/tabs/history">
            <IonIcon aria-hidden="true" icon={receiptOutline} />
            <IonLabel>Riwayat</IonLabel>
          </IonTabButton>
        </IonTabBar>
      )}
    </IonTabs>
  );
};

export default Tabs;
