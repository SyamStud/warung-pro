import { Navigate, Route } from 'react-router-dom';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { cartOutline, listOutline, pricetagOutline, receiptOutline } from 'ionicons/icons';
import PriceChecker from './PriceChecker';
import Products from './Products';
import Pos from './Pos';
import History from './History';

/** Bottom tab shell: Price Checker (default) · Products · POS · History. */
const Tabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route path="/tabs/check" element={<PriceChecker />} />
      <Route path="/tabs/products" element={<Products />} />
      <Route path="/tabs/pos" element={<Pos />} />
      <Route path="/tabs/history" element={<History />} />
      <Route path="/tabs" element={<Navigate to="/tabs/check" replace />} />
    </IonRouterOutlet>

    <IonTabBar slot="bottom">
      <IonTabButton tab="check" href="/tabs/check">
        <IonIcon aria-hidden="true" icon={pricetagOutline} />
        <IonLabel>Cek Harga</IonLabel>
      </IonTabButton>
      <IonTabButton tab="products" href="/tabs/products">
        <IonIcon aria-hidden="true" icon={listOutline} />
        <IonLabel>Produk</IonLabel>
      </IonTabButton>
      <IonTabButton tab="pos" href="/tabs/pos">
        <IonIcon aria-hidden="true" icon={cartOutline} />
        <IonLabel>Kasir</IonLabel>
      </IonTabButton>
      <IonTabButton tab="history" href="/tabs/history">
        <IonIcon aria-hidden="true" icon={receiptOutline} />
        <IonLabel>Riwayat</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default Tabs;
