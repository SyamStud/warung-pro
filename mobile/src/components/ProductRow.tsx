import type { ReactNode } from 'react';
import { formatRupiah } from '../lib/format';
import type { Product } from '../types';

interface ProductRowProps {
  product: Product;
  onClick?: () => void;
  /** Extra content on the right (steppers, badges, add buttons). */
  aside?: ReactNode;
  className?: string;
}

/**
 * The one product row used by Beranda, Katalog, POS and Cek Harga:
 * thumbnail tile · name · SKU · blue price.
 */
const ProductRow: React.FC<ProductRowProps> = ({ product, onClick, aside, className }) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={['product-row', className].filter(Boolean).join(' ')}
    >
      <span className="thumb" aria-hidden="true">
        {product.name.trim().charAt(0).toUpperCase() || '?'}
      </span>

      <span className="product-row__main">
        <span className="product-row__name">{product.name}</span>
        <span className="product-row__sku">
          {product.sku}
          {product.unit ? ` · ${product.unit}` : ''}
        </span>
      </span>

      {aside ?? (
        <span className="product-row__aside">
          <span className="product-row__price">{formatRupiah(product.selling_price)}</span>
          {product.id < 0 && <span className="badge badge--amber">Menunggu</span>}
          {!product.is_active && <span className="badge badge--grey">Arsip</span>}
        </span>
      )}
    </Tag>
  );
};

export default ProductRow;
