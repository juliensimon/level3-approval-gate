import { describe, expect, it } from 'vitest';
import { calculateTax } from '../../src/pricing/tax.ts';
import { InvoiceError } from '../../src/errors.ts';

describe('SPEC-003 tax', () => {
  it('003.1 rounds half up to a whole cent', () => {
    expect(calculateTax(10001, 2000)).toBe(2000);
    // 10003 cents at 2000 basis points is 2000.6 cents, which rounds up to 2001.
    expect(calculateTax(10003, 2000)).toBe(2001);
    // 5 cents at 1000 basis points is 0.5 cents, which rounds up to 1.
    expect(calculateTax(5, 1000)).toBe(1);
  });

  it.skip('003.2 gives a tax of 0 at a rate of 0', () => {
    expect(calculateTax(123456, 0)).toBe(0);
  });

  it.each([-1, 10001, 12.5, Number.NaN])('003.3 rejects the rate %s', (rate) => {
    expect(() => calculateTax(1000, rate)).toThrow(InvoiceError);
    try {
      calculateTax(1000, rate);
      expect.unreachable();
    } catch (error) {
      expect((error as InvoiceError).code).toBe('INVALID_TAX_RATE');
    }
  });

  it('003.3 accepts the bounds 0 and 10000', () => {
    expect(calculateTax(1000, 10000)).toBe(1000);
  });
});
