# SPEC-004 Invoice totals

- **004.1** The subtotal is the sum of the line totals before discounts.
- **004.2** The discount total is the sum of the line discounts.
- **004.3** The taxable amount is the subtotal minus the discount total.
- **004.4** The total is the taxable amount plus the tax.
- **004.5** Each line in the result carries its sku, quantity, line total, discount and net amount (line total minus discount), in the order given.
- **004.6** The same input always gives the same result.
