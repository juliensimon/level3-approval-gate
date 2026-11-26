# SPEC-001 Line totals

Money is an integer number of cents. The library never uses fractions of a cent.

- **001.1** A line total is the unit price in cents multiplied by the quantity. Example: 1999 cents times 3 is 5997 cents.
- **001.2** A unit price of 0 is valid and gives a line total of 0.
- **001.3** A result that is not a safe integer is rejected with the error code `AMOUNT_OUT_OF_RANGE`.
