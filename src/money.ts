import { InvoiceError } from './errors.ts';

/** Money is an integer number of cents. */
export type Cents = number;

export function assertPriceCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvoiceError('INVALID_PRICE', `Unit price must be a whole number of cents, got ${value}.`);
  }
}

export function assertQuantity(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InvoiceError('INVALID_QUANTITY', `Quantity must be a positive whole number, got ${value}.`);
  }
}

export function assertInRange(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new InvoiceError('AMOUNT_OUT_OF_RANGE', 'Amount is not a safe integer.');
  }
  return value;
}

export function lineTotal(unitPriceCents: Cents, quantity: number): Cents {
  assertPriceCents(unitPriceCents);
  assertQuantity(quantity);
  return assertInRange(unitPriceCents * quantity);
}

/** The share of an amount in basis points (1 basis point is 0.01 percent), rounded half up. */
export function percentOf(amountCents: Cents, basisPoints: number): Cents {
  return Math.floor(assertInRange(amountCents * basisPoints + 5000) / 10000);
}
