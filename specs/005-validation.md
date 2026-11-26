# SPEC-005 Input validation

Invalid input is rejected with an `InvoiceError` that carries a stable error code. Nothing is silently corrected.

- **005.1** An invoice with no lines is rejected with `NO_LINES`.
- **005.2** A quantity that is not a positive whole number is rejected with `INVALID_QUANTITY`.
- **005.3** A unit price that is negative or not a whole number is rejected with `INVALID_PRICE`.
- **005.4** An empty sku is rejected with `INVALID_SKU`.
- **005.5** A currency that is not three uppercase letters is rejected with `INVALID_CURRENCY`.
