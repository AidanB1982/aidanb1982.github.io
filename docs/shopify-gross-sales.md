# Reported Shopify gross sales

Sales & Royalties displays source-reported Shopify gross sales separately in
**Platform Breakdown**. KDP royalties, IngramSpark compensation and Tide
customer payments keep their existing calculations.

`sales_report_lines` supports two optional fields:

- `gross_sales`: the reported product gross-sales amount in the parent batch's
  currency. `NULL` means the source did not supply this figure; a recorded zero
  remains distinguishable from missing data.
- `gross_sales_source`: report provenance and the covered period. Store no
  customer contact details or credentials here.

The schema extension is in
[20261107190000_shopify_reported_gross_sales.sql](../supabase/migrations/20261107190000_shopify_reported_gross_sales.sql).
It requires the existing publishing sales tables. It adds no data and changes
no row policies or grants. Owner-specific source imports remain private and
are not included in this repository.

Before adding amounts, check existing source rows, their report periods,
currency, product links and any previously reported gross-sales values. Attach
matching monetary figures to existing rows when appropriate. Do not create
another quantity/order record for the same activity. Preserve the original
notes and source fields, and retain provenance for the new amount.

A comparison report may include another period's figures alongside the selected
period. Keep those periods separate. Gross sales alone do not establish item
quantities, discounts, returns, fees, fulfilment costs, net proceeds or payouts.
They do not establish a cleared author-payable balance.

The dashboard honours its existing date, book, format and GBP filters. Where
only some product records have gross-sales amounts, it labels the total as
recorded gross sales and shows coverage. It does not turn missing quantities
into zero units, or calculate gross sales from average order value. Title-only
product links do not imply a particular edition format.

The page remains usable before this migration is applied: a missing-column
response for these two optional fields retries the existing source columns.
Other database errors remain visible. After the schema and source figures are
added, refresh the dashboard to load the reported amounts.

Browser regression coverage uses fictional records and mock services in
`tests/shopify-gross-browser.cjs`; it does not contact Shopify or Supabase.
