import { InvoiceError } from '../errors.ts';
import { percentOf, type Cents } from '../money.ts';

export function assertTaxRate(basisPoints: number): void {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new InvoiceError(
      'INVALID_TAX_RATE',
      `Tax rate must be a whole number of basis points from 0 to 10000, got ${basisPoints}.`,
    );
  }
}

export function calculateTax(taxableCents: Cents, rateBasisPoints: number): Cents {
  assertTaxRate(rateBasisPoints);
  return percentOf(taxableCents, rateBasisPoints);
}
