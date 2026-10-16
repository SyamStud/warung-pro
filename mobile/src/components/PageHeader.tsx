import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  /**
   * Explicit destination for the back arrow. Set it on pages you can reach
   * from several directions (Cek Harga, Pembayaran, Preview Struk); on the
   * tabs the arrow returns to Beranda.
   */
  backHref?: string;
  /** Hide the arrow on the app's root screen (Beranda). */
  hideBack?: boolean;
  /**
   * Custom action for the arrow — modals use it to dismiss themselves instead
   * of pushing a route.
   */
  onBack?: () => void;
  /** Right-aligned controls (sync indicator, printer, scan, ...). */
  actions?: React.ReactNode;
}

const HOME = '/tabs/home';

/**
 * The in-page title bar: back arrow, title and actions sitting on the page
 * background, part of the content instead of a detached navbar.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, backHref, hideBack, onBack, actions }) => {
  const navigate = useNavigate();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    navigate(backHref ?? HOME);
  };

  return (
    <header className="page-head">
      {!hideBack && (
        <button type="button" className="page-head__back" aria-label="Kembali" onClick={goBack}>
          <IonIcon icon={arrowBackOutline} />
        </button>
      )}

      <h1 className="page-head__title">{title}</h1>

      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
};

export default PageHeader;
