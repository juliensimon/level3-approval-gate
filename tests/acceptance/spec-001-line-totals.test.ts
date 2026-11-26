import { describe, expect, it } from 'vitest';
import { lineTotal } from '../../src/money.ts';
import { InvoiceError } from '../../src/errors.ts';

describe('SPEC-001 line totals', () => {
  it('001.1 multiplies the unit price by the quantity', () => {
    expect(lineTotal(1999, 3)).toBe(5997);
  });

  it('001.2 accepts a unit price of 0', () => {
    expect(lineTotal(0, 12)).toBe(0);
  });

  it('001.3 rejects a result that is not a safe integer', () => {
    expect(() => lineTotal(Number.MAX_SAFE_INTEGER, 2)).toThrow(InvoiceError);
    try {
      lineTotal(Number.MAX_SAFE_INTEGER, 2);
      expect.unreachable();
    } catch (error) {
      expect((error as InvoiceError).code).toBe('AMOUNT_OUT_OF_RANGE');
    }
  });
});
