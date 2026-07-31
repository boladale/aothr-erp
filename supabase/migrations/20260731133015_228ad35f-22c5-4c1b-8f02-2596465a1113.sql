DO $$
DECLARE
  r record;
  t text; c text; col text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('requisitions','requisitions_req_number_key','req_number','REQ'),
    ('purchase_orders','purchase_orders_po_number_key','po_number','PO'),
    ('rfps','rfps_rfp_number_key','rfp_number','RFQ'),
    ('goods_receipts','goods_receipts_grn_number_key','grn_number','GRN'),
    ('delivery_notes','delivery_notes_dn_number_key','dn_number','DN'),
    ('sales_orders','sales_orders_order_number_key','order_number','SO'),
    ('sales_quotations','sales_quotations_quotation_number_key','quotation_number','SQ'),
    ('ap_payments','ap_payments_payment_number_key','payment_number','PAY'),
    ('ar_invoices','ar_invoices_invoice_number_key','invoice_number','ARINV'),
    ('ar_receipts','ar_receipts_receipt_number_key','receipt_number','RCP'),
    ('ar_credit_notes','ar_credit_notes_credit_note_number_key','credit_note_number','ARCN'),
    ('inventory_adjustments','inventory_adjustments_adjustment_number_key','adjustment_number','ADJ'),
    ('inventory_transfers','inventory_transfers_transfer_number_key','transfer_number','TRF'),
    ('fund_transfers','fund_transfers_transfer_number_key','transfer_number','FT')
  ) AS v(tbl, cons, colname, doctype)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.cons AND conrelid = ('public.'||r.tbl)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.cons);
    END IF;
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (organization_id, %I)',
                   r.tbl||'_org_'||r.colname||'_uidx', r.tbl, r.colname);
  END LOOP;
END $$;

-- Re-sync counters to the highest existing document number per organization
DO $$
DECLARE
  r record;
  q text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('requisitions','req_number','REQ','REQ'),
    ('purchase_orders','po_number','PO','PO'),
    ('rfps','rfp_number','RFQ','RFQ'),
    ('goods_receipts','grn_number','GRN','GRN'),
    ('delivery_notes','dn_number','DN','DN'),
    ('sales_orders','order_number','SO','SO'),
    ('sales_quotations','quotation_number','SQ','SQ'),
    ('ap_payments','payment_number','PAY','PAY'),
    ('ar_invoices','invoice_number','ARINV','ARINV'),
    ('ar_receipts','receipt_number','RCP','RCP'),
    ('ar_credit_notes','credit_note_number','ARCN','ARCN'),
    ('inventory_adjustments','adjustment_number','ADJ','ADJ'),
    ('inventory_transfers','transfer_number','TRF','TRF'),
    ('fund_transfers','transfer_number','FT','FT')
  ) AS v(tbl, colname, doctype, prefix)
  LOOP
    q := format($f$
      INSERT INTO public.transaction_counters (organization_id, document_type, prefix, last_number)
      SELECT t.organization_id, %L, %L, t.mx
      FROM (
        SELECT organization_id,
               MAX(COALESCE(NULLIF(regexp_replace(%I, '^.*-', ''), '')::bigint, 0)) AS mx
        FROM public.%I
        WHERE organization_id IS NOT NULL AND %I ~ '-[0-9]+$'
        GROUP BY organization_id
      ) t
      ON CONFLICT (organization_id, document_type)
      DO UPDATE SET last_number = GREATEST(public.transaction_counters.last_number, EXCLUDED.last_number)
    $f$, r.doctype, r.prefix, r.colname, r.tbl, r.colname);
    EXECUTE q;
  END LOOP;
END $$;