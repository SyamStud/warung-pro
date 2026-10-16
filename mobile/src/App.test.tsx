import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { queryClient } from './lib/queryClient';

// With no stored token, AuthProvider settles unauthenticated and the app
// should route straight to the login screen.
test('renders the login screen when unauthenticated', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );

  expect((await screen.findAllByText('Masuk')).length).toBeGreaterThan(0);
});
