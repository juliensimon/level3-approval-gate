import { describe, expect, it } from 'vitest';
import { computeInvoice } from '../../src/invoice.ts';
import { percentOf } from '../../src/money.ts';
import { InvoiceError } from '../../src/errors.ts';

describe('range checks', () => {
  it('percentOf rejects an intermediate result that is not a safe integer', () => {
    expect(() => percentOf(Number.MAX_SAFE_INTEGER, 10000)).toThrow(InvoiceError);
  });

  it('computeInvoice rejects a subtotal that is not a safe integer', () => {
    const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    expect(() =>
      computeInvoice({
        currency: 'EUR',
        taxRateBasisPoints: 0,
        lines: [
          { sku: 'A', unitPriceCents: half, quantity: 1 },
          { sku: 'B', unitPriceCents: half, quantity: 1 },
        ],
      }),
    ).toThrow(/safe integer/);
  });

  it('a quantity of 1 and a price of 1 give a total of 1 with no discount', () => {
    const result = computeInvoice({
      currency: 'EUR',
      taxRateBasisPoints: 0,
      lines: [{ sku: 'A', unitPriceCents: 1, quantity: 1 }],
    });
    expect(result.totalCents).toBe(1);
    expect(result.discountCents).toBe(0);
  });
});
