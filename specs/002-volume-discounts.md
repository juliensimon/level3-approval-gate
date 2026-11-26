# SPEC-002 Volume discounts

A discount applies to each line, based on the quantity of that line. Rates are in basis points (1 basis point is 0.01 percent).

| Quantity on the line | Discount |
|---|---|
| 1 to 9 | 0 basis points |
| 10 to 49 | 500 basis points (5 percent) |
| 50 to 99 | 1000 basis points (10 percent) |
| 100 or more | 1500 basis points (15 percent) |

- **002.1** Each tier applies from its lower bound. Quantity 9 has no discount, quantity 10 has 500 basis points, 49 has 500, 50 has 1000, 99 has 1000, 100 has 1500.
- **002.2** The discount amount is the line total times the rate, rounded half up to a whole cent.
- **002.3** A line with no discount has a discount amount of 0.
