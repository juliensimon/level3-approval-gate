import type { Cents } from '../money.ts';

/** Round up to the next whole 10 cents. Not covered by any test. */
export function roundUpToTenCents(amount: Cents): Cents {
  return (Math.ceil(amount / 10) * 10) as Cents;
}
