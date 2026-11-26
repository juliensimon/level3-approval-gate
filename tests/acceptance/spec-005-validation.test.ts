import { describe, expect, it } from 'vitest';
import { computeInvoice, type InvoiceInput } from '../../src/invoice.ts';
import { InvoiceError } from '../../src/errors.ts';

const valid: InvoiceInput = {
  currency: 'USD',
  taxRateBasisPoints: 0,
  lines: [{ sku: 'A-1', unitPriceCents: 100, quantity: 1 }],
};

function codeOf(input: InvoiceInput): string | undefined {
  try {
    computeInvoice(input);
    return undefined;
  } catch (error) {
    return error instanceof InvoiceError ? error.code : 'NOT_AN_INVOICE_ERROR';
  }
}

describe('SPEC-005 input validation', () => {
  it('accepts a valid invoice', () => {
    expect(codeOf(valid)).toBeUndefined();
  });

  it('005.1 rejects an invoice with no lines', () => {
    expect(codeOf({ ...valid, lines: [] })).toBe('NO_LINES');
  });

  it.each([0, -1, 1.5, Number.NaN])('005.2 rejects the quantity %s', (quantity) => {
    expect(codeOf({ ...valid, lines: [{ sku: 'A-1', unitPriceCents: 100, quantity }] })).toBe(
      'INVALID_QUANTITY',
    );
  });

  it.each([-1, 0.5, Number.NaN])('005.3 rejects the unit price %s', (unitPriceCents) => {
    expect(codeOf({ ...valid, lines: [{ sku: 'A-1', unitPriceCents, quantity: 1 }] })).toBe(
      'INVALID_PRICE',
    );
  });

  it('005.4 rejects an empty sku', () => {
    expect(codeOf({ ...valid, lines: [{ sku: '', unitPriceCents: 100, quantity: 1 }] })).toBe(
      'INVALID_SKU',
    );
  });

  it.each(['eur', 'EU', 'EURO', '', 'E1R'])('005.5 rejects the currency %j', (currency) => {
    expect(codeOf({ ...valid, currency })).toBe('INVALID_CURRENCY');
  });
});
