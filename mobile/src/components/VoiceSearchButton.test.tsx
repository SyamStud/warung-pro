import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import VoiceSearchButton from './VoiceSearchButton';
import { VoiceError } from '../services/voice';

const listen = vi.fn<() => Promise<string>>();

vi.mock('../services/voice', async () => {
  const actual = await vi.importActual<typeof import('../services/voice')>('../services/voice');

  return { ...actual, voiceService: { listen: () => listen() } };
});

const onResult = vi.fn();
const onError = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function renderButton(props: { disabled?: boolean } = {}) {
  return render(<VoiceSearchButton onResult={onResult} onError={onError} {...props} />);
}

test('menyerahkan hasil ucapan ke halaman', async () => {
  listen.mockResolvedValue('susu');

  renderButton();
  fireEvent.click(screen.getByRole('button', { name: /cari dengan suara/i }));

  await waitFor(() => expect(onResult).toHaveBeenCalledWith('susu'));
  expect(onError).not.toHaveBeenCalled();
});

test('meneruskan kegagalan beserta alasannya', async () => {
  listen.mockRejectedValue(new VoiceError('permission'));

  renderButton();
  fireEvent.click(screen.getByRole('button', { name: /cari dengan suara/i }));

  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  expect(onError.mock.calls[0][0]).toBeInstanceOf(VoiceError);
  expect(onError.mock.calls[0][0].reason).toBe('permission');
});

test('menampilkan keadaan mendengarkan dan tidak bisa ditekan dua kali', async () => {
  let finish: (text: string) => void = () => {};
  listen.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );

  renderButton();
  fireEvent.click(screen.getByRole('button', { name: /cari dengan suara/i }));

  const button = await screen.findByRole('button', { name: /mendengarkan/i });
  expect(button).toBeDisabled();
  expect(listen).toHaveBeenCalledTimes(1);

  fireEvent.click(button);
  expect(listen).toHaveBeenCalledTimes(1);

  finish('susu');
  await waitFor(() => expect(onResult).toHaveBeenCalledWith('susu'));
});

test('tidak mendengarkan saat pemindai barcode sedang jalan', () => {
  renderButton({ disabled: true });

  fireEvent.click(screen.getByRole('button', { name: /cari dengan suara/i }));

  expect(listen).not.toHaveBeenCalled();
});
