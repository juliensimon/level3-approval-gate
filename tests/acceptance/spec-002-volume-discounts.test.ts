import { describe, expect, it } from 'vitest';
import { discountRateBasisPoints, lineDiscount } from '../../src/pricing/discount.ts';

describe('SPEC-002 volume discounts', () => {
  it.each([
    [1, 0],
    [9, 0],
    [10, 500],
    [49, 500],
    [50, 1000],
    [99, 1000],
    [100, 1500],
    [5000, 1500],
  ])('002.1 quantity %i has a rate of %i basis points', (quantity, rate) => {
    expect(discountRateBasisPoints(quantity)).toBe(rate);
  });

  it('002.2 rounds the discount half up to a whole cent', () => {
    // 10 x 1001 = 10010 cents; 5 percent is 500.5 cents, which rounds up to 501.
    expect(lineDiscount(10010, 10)).toBe(501);
    // 10 x 1009 = 10090 cents; 5 percent is 504.5 cents, which rounds up to 505.
    expect(lineDiscount(10090, 10)).toBe(505);
    // 50 x 1 = 50 cents; 10 percent is 5 cents exactly.
    expect(lineDiscount(50, 50)).toBe(5);
    // 10 x 1 = 10 cents; 5 percent is 0.5 cents, which rounds up to 1.
    expect(lineDiscount(10, 10)).toBe(1);
  });

  it('002.3 gives a discount of 0 when no tier applies', () => {
    expect(lineDiscount(8991, 9)).toBe(0);
  });
});
