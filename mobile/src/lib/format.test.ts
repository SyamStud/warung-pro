import { expect, test } from 'vitest';
import { digitsOnly, formatThousands } from './format';

test('digitsOnly keeps only the digits of a typed amount', () => {
  expect(digitsOnly('Rp 20.000')).toBe('20000');
  expect(digitsOnly('12a3')).toBe('123');
  expect(digitsOnly('abc')).toBe('');
});

test('formatThousands groups digits with dots', () => {
  expect(formatThousands('20000')).toBe('20.000');
  expect(formatThousands('1000000')).toBe('1.000.000');
});

test('formatThousands leaves short numbers and an empty box alone', () => {
  expect(formatThousands('500')).toBe('500');
  expect(formatThousands('')).toBe('');
});

test('formatThousands accepts an already formatted value', () => {
  expect(formatThousands('20.000')).toBe('20.000');
});
