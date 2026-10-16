import type { Transaction } from '../../types';

/** A representative transaction used for the "test print" action. */
export function createSampleTransaction(): Transaction {
  return {
    id: 0,
    transaction_number: 'TRX-00000000-0000',
    status: 'paid',
    subtotal: 12000,
    discount_amount: 1000,
    total: 11000,
    paid_amount: 15000,
    change_amount: 4000,
    payment_method: 'cash',
    created_at: new Date().toISOString(),
    items: [
      {
        id: 1,
        product_id: 1,
        product_name: 'Air Mineral 600ml',
        sku: '8991234567890',
        unit_price: 4000,
        quantity: 2,
        line_total: 8000,
      },
      {
        id: 2,
        product_id: 2,
        product_name: 'Kopi Sachet',
        sku: 'PRD-000002',
        unit_price: 4000,
        quantity: 1,
        line_total: 4000,
      },
    ],
  };
}
