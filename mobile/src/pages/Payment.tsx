import { useEffect, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { cashOutline, cardOutline, cartOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
import { useCart } from '../cart/useCart';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatRupiah } from '../lib/format';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../types';

const CASH_SUGGESTIONS = [20000, 50000, 100000];

/** 9 · Pembayaran — discount, payment method, cash received, and checkout. */
const Payment: React.FC = () => {
  const navigate = useNavigate();
  const cart = useCart();
  const online = useOnlineStatus();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  const [submitting, setSubmitting] = useState(false);

  const { total } = cart.totals;
  const isCash = cart.paymentMethod === 'cash';
  const setPaid = cart.setPaid;

  // Non-cash sales are settled in full, so there is no change to give.
  useEffect(() => {
    if (cart.paymentMethod === 'non_cash') {
      setPaid(String(Math.max(0, total)));
    }
  }, [cart.paymentMethod, total, setPaid]);

  const effectivePaid = isCash ? cart.totals.paidAmount : Math.max(0, total);
  const changeAmount = Math.max(0, effectivePaid - Math.max(0, total));
  const canPay = online && cart.lines.length > 0 && total >= 0 && effectivePaid >= total && !submitting;

  const pay = async () => {
    setSubmitting(true);
    try {
      const result = await cart.checkout();

      if (!result.ok) {
        presentAlert({ header: 'Transaksi gagal', message: result.error ?? '', buttons: ['OK'] });
        return;
      }

      presentToast({ message: 'Transaksi tersimpan.', duration: 2000, color: 'success', position: 'top' });
      navigate('/tabs/receipt', { state: { id: result.transactionId }, replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.lines.length === 0) {
    return (
      <IonPage>
        <IonContent>
          <PageHeader title="Pembayaran" backHref="/tabs/pos" />

          <div className="screen">
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={cartOutline} />
              <p className="empty-state__title">Tidak ada yang dibayar</p>
              <p className="empty-state__text">Keranjang kosong. Tambahkan produk dulu di POS.</p>
              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 16 }}
                onClick={() => navigate('/tabs/pos')}
              >
                Kembali ke POS
              </button>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Pembayaran" backHref="/tabs/pos" />

        <ConnectionBanner />

        <div className="screen">
          <div className="card">
            <div className="card__head">
              <h2 className="card__title">Ringkasan pesanan</h2>
              <span className="badge badge--blue">{cart.itemCount} item</span>
            </div>

            {cart.lines.map((line) => (
              <div key={line.product.id} className="receipt-card__item">
                <span>
                  <span className="receipt-card__item-name">{line.product.name}</span>
                  <span className="receipt-card__item-sub" style={{ display: 'block' }}>
                    {line.quantity} × {formatRupiah(line.product.selling_price)}
                  </span>
                </span>
                <span className="totals__value">
                  {formatRupiah(line.product.selling_price * line.quantity)}
                </span>
              </div>
            ))}

            <hr className="totals__divider" />

            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span className="totals__value">{formatRupiah(cart.totals.subtotal)}</span>
              </div>
              {cart.totals.discountAmount > 0 && (
                <div className="totals__row">
                  <span>Diskon</span>
                  <span className="totals__value">
                    -{formatRupiah(cart.totals.discountAmount)}
                  </span>
                </div>
              )}
              <div className="totals__row totals__row--strong">
                <span>Total</span>
                <span className="totals__value">{formatRupiah(Math.max(0, total))}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">Diskon (Rp)</span>
              <div className="field__row">
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={cart.discount}
                  placeholder="0"
                  onChange={(e) => cart.setDiscount(e.target.value)}
                />
                {cart.discount !== '' && (
                  <button
                    type="button"
                    className="btn btn--plain"
                    style={{ width: 'auto', paddingInline: 16 }}
                    onClick={() => cart.setDiscount('')}
                  >
                    Reset
                  </button>
                )}
              </div>
            </label>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h2 className="card__title" style={{ marginBottom: 10 }}>
              Metode pembayaran
            </h2>
            <div className="segmented" role="tablist" aria-label="Metode pembayaran">
              {(['cash', 'non_cash'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  role="tab"
                  aria-selected={cart.paymentMethod === method}
                  className={`segmented__option${
                    cart.paymentMethod === method ? ' segmented__option--active' : ''
                  }`}
                  onClick={() => cart.setPaymentMethod(method)}
                >
                  <IonIcon icon={method === 'cash' ? cashOutline : cardOutline} />{' '}
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>

            {isCash ? (
              <>
                <label className="field" style={{ marginTop: 14, marginBottom: 8 }}>
                  <span className="field__label">Dibayar (Rp)</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={cart.paid}
                    placeholder="0"
                    onChange={(e) => cart.setPaid(e.target.value)}
                  />
                </label>

                <div className="chip-row">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => cart.setPaid(String(Math.max(0, total)))}
                  >
                    Uang pas
                  </button>
                  {CASH_SUGGESTIONS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="chip"
                      onClick={() => cart.setPaid(String(amount))}
                    >
                      {formatRupiah(amount)}
                    </button>
                  ))}
                </div>

                <div className="totals" style={{ marginTop: 14 }}>
                  <div className="totals__row totals__row--accent">
                    <span>Kembalian</span>
                    <span className="totals__value">{formatRupiah(changeAmount)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="field__hint" style={{ marginTop: 12 }}>
                Pembayaran non tunai dicatat sebesar total. Pastikan dana sudah diterima.
              </p>
            )}
          </div>

          {!online && (
            <IonNote className="note note--warn" style={{ marginTop: 12 }}>
              Transaksi memerlukan koneksi ke server.
            </IonNote>
          )}

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            disabled={!canPay}
            onClick={pay}
          >
            {submitting ? <IonSpinner name="dots" /> : `Bayar ${formatRupiah(Math.max(0, total))}`}
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Payment;
