-- Optional reported sales amounts share the source row's existing permissions.
-- NULL means that the source report did not supply a gross-sales figure.
-- This migration does not populate sales, quantities, payouts or author balances.
BEGIN;

DO $shopify_gross_fields$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.sales_report_lines'::regclass
      AND a.attname IN ('gross_sales', 'gross_sales_source')
      AND NOT a.attisdropped
      AND (
        a.attnotnull OR a.atthasdef OR a.attgenerated <> '' OR a.attidentity <> ''
        OR (a.attname = 'gross_sales' AND format_type(a.atttypid, a.atttypmod) <> 'numeric(14,4)')
        OR (a.attname = 'gross_sales_source' AND format_type(a.atttypid, a.atttypmod) <> 'text')
      )
  ) THEN
    RAISE EXCEPTION 'Existing gross-sales fields must be nullable, ungenerated numeric(14,4) and text, with no defaults.';
  END IF;
END
$shopify_gross_fields$;

ALTER TABLE public.sales_report_lines
  ADD COLUMN IF NOT EXISTS gross_sales numeric(14,4),
  ADD COLUMN IF NOT EXISTS gross_sales_source text;

COMMENT ON COLUMN public.sales_report_lines.gross_sales IS
  'Reported product gross sales in the parent batch currency for this source row. NULL means not supplied; distinct from net sales, compensation and payment amounts.';
COMMENT ON COLUMN public.sales_report_lines.gross_sales_source IS
  'Provenance of the reported gross-sales figure, including its source report and covered period. No customer contact details or credentials.';

NOTIFY pgrst, 'reload schema';
COMMIT;
