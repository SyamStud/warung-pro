import { useContext } from 'react';
import { ShareInboxContext, type ShareInboxValue } from './context';

export function useShareInbox(): ShareInboxValue {
  const value = useContext(ShareInboxContext);

  if (value === null) {
    throw new Error('useShareInbox must be used inside a ShareInboxProvider');
  }

  return value;
}
