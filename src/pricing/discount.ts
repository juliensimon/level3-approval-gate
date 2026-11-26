import { percentOf, type Cents } from '../money.ts';

/** Sample tiers for the demo, highest first. Change them only with a matching change to specs/002-volume-discounts.md. */
const TIERS = [
  { minQuantity: 100, basisPoints: 1500 },
  { minQuantity: 50, basisPoints: 1000 },
  { minQuantity: 10, basisPoints: 500 },
] as const;

export function discountRateBasisPoints(quantity: number): number {
  return TIERS.find((tier) => quantity >= tier.minQuantity)?.basisPoints ?? 0;
}

export function lineDiscount(lineTotalCents: Cents, quantity: number): Cents {
  return percentOf(lineTotalCents, discountRateBasisPoints(quantity));
}
