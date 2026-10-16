import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { queryClient } from './lib/queryClient';

// With no stored token, AuthProvider settles unauthenticated and the app
// opens on the splash screen (screen 1 of the mockup flow).
test('renders the splash screen when unauthenticated', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );

  expect((await screen.findAllByText('Mulai')).length).toBeGreaterThan(0);
  expect(screen.getByText('Cek harga & kasir untuk warung kamu')).toBeTruthy();
});
