import { describe, expect, it } from 'vitest';
import { computeInvoice, type InvoiceInput } from '../../src/invoice.ts';
import { lineTotal } from '../../src/money.ts';
import { calculateTax } from '../../src/pricing/tax.ts';

const valid: InvoiceInput = {
  currency: 'USD',
  taxRateBasisPoints: 0,
  lines: [{ sku: 'A-1', unitPriceCents: 100, quantity: 1 }],
};

describe('error messages say what to fix', () => {
  it.each([
    [{ ...valid, currency: 'usd' }, /currency/i],
    [{ ...valid, lines: [] }, /at least one line/i],
    [{ ...valid, lines: [{ sku: '', unitPriceCents: 1, quantity: 1 }] }, /sku/i],
  ])('invoice input %#', (input, message) => {
    expect(() => computeInvoice(input)).toThrow(message);
  });

  it('names the bad quantity and the bad price', () => {
    expect(() => lineTotal(100, 0)).toThrow('Quantity must be a positive whole number, got 0.');
    expect(() => lineTotal(-5, 1)).toThrow('Unit price must be a whole number of cents, got -5.');
  });

  it('names the bad tax rate', () => {
    expect(() => calculateTax(100, 10001)).toThrow(/got 10001/);
  });
});
