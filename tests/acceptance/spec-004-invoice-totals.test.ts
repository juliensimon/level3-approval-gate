import { describe, expect, it } from 'vitest';
import { computeInvoice, type InvoiceInput } from '../../src/invoice.ts';

const input: InvoiceInput = {
  currency: 'EUR',
  taxRateBasisPoints: 2000,
  lines: [
    { sku: 'A-1', unitPriceCents: 1999, quantity: 3 },
    { sku: 'B-2', unitPriceCents: 1001, quantity: 10 },
    { sku: 'C-3', unitPriceCents: 250, quantity: 100 },
  ],
};
// A-1: 5997, no discount.
// B-2: 10010, discount 501 (5 percent, half up).
// C-3: 25000, discount 3750 (15 percent).

describe('SPEC-004 invoice totals', () => {
  const result = computeInvoice(input);

  it('004.1 the subtotal is the sum of the line totals', () => {
    expect(result.subtotalCents).toBe(5997 + 10010 + 25000);
  });

  it('004.2 the discount total is the sum of the line discounts', () => {
    expect(result.discountCents).toBe(0 + 501 + 3750);
  });

  it('004.3 the taxable amount is the subtotal minus the discount total', () => {
    expect(result.taxableCents).toBe(41007 - 4251);
  });

  it('004.4 the total is the taxable amount plus the tax', () => {
    // 36756 cents at 2000 basis points is 7351.2 cents, so 7351.
    expect(result.taxCents).toBe(7351);
    expect(result.totalCents).toBe(36756 + 7351);
  });

  it('004.5 each line carries its figures, in the order given', () => {
    expect(result.lines).toEqual([
      { sku: 'A-1', quantity: 3, lineTotalCents: 5997, discountCents: 0, netCents: 5997 },
      { sku: 'B-2', quantity: 10, lineTotalCents: 10010, discountCents: 501, netCents: 9509 },
      { sku: 'C-3', quantity: 100, lineTotalCents: 25000, discountCents: 3750, netCents: 21250 },
    ]);
    expect(result.currency).toBe('EUR');
  });

  it('004.6 the same input always gives the same result', () => {
    expect(computeInvoice(input)).toEqual(result);
  });
});
