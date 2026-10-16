import { useContext } from 'react';
import { CartContext, type CartContextValue } from './context';

/** Access the shared cart. Must be used inside <CartProvider>. */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
