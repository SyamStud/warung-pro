import { render, screen } from '@testing-library/react';
import { afterEach, test, expect } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import ConnectionBanner from './ConnectionBanner';

afterEach(() => onlineManager.setOnline(true));

test('renders the offline banner when the device is offline', () => {
  onlineManager.setOnline(false);

  render(<ConnectionBanner />);

  expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
});

test('renders nothing when the device is online', () => {
  onlineManager.setOnline(true);

  const { container } = render(<ConnectionBanner />);

  expect(container).toBeEmptyDOMElement();
});
