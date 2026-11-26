import { InvoiceError } from './errors.ts';
import { assertInRange, lineTotal, type Cents } from './money.ts';
import { lineDiscount } from './pricing/discount.ts';
import { calculateTax } from './pricing/tax.ts';

export interface LineInput {
  sku: string;
  unitPriceCents: Cents;
  quantity: number;
}

export interface InvoiceInput {
  currency: string;
  taxRateBasisPoints: number;
  lines: readonly LineInput[];
}

export interface LineResult {
  sku: string;
  quantity: number;
  lineTotalCents: Cents;
  discountCents: Cents;
  netCents: Cents;
}

export interface InvoiceResult {
  currency: string;
  lines: LineResult[];
  subtotalCents: Cents;
  discountCents: Cents;
  taxableCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

function priceLine(line: LineInput): LineResult {
  if (line.sku === '') {
    throw new InvoiceError('INVALID_SKU', 'Sku must not be empty.');
  }
  const total = lineTotal(line.unitPriceCents, line.quantity);
  const discount = lineDiscount(total, line.quantity);
  return {
    sku: line.sku,
    quantity: line.quantity,
    lineTotalCents: total,
    discountCents: discount,
    netCents: total - discount,
  };
}

function sum(values: readonly Cents[]): Cents {
  return assertInRange(values.reduce((acc, value) => acc + value, 0));
}

export function computeInvoice(input: InvoiceInput): InvoiceResult {
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new InvoiceError('INVALID_CURRENCY', 'Currency must be three uppercase letters.');
  }
  if (input.lines.length === 0) {
    throw new InvoiceError('NO_LINES', 'An invoice needs at least one line.');
  }
  const lines = input.lines.map(priceLine);
  const subtotalCents = sum(lines.map((l) => l.lineTotalCents));
  const discountCents = sum(lines.map((l) => l.discountCents));
  const taxableCents = subtotalCents - discountCents;
  const taxCents = calculateTax(taxableCents, input.taxRateBasisPoints);
  return {
    currency: input.currency,
    lines,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}
