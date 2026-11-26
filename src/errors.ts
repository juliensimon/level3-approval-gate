export type InvoiceErrorCode =
  | 'AMOUNT_OUT_OF_RANGE'
  | 'INVALID_TAX_RATE'
  | 'NO_LINES'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRICE'
  | 'INVALID_SKU'
  | 'INVALID_CURRENCY';

/** Every rejection carries a stable code, so callers never parse messages. */
export class InvoiceError extends Error {
  readonly code: InvoiceErrorCode;

  constructor(code: InvoiceErrorCode, message: string) {
    super(message);
    this.name = 'InvoiceError';
    this.code = code;
  }
}
