CREATE OR REPLACE FUNCTION public.ai_purchase_order_details()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['procurement_dashboard','procurement_reports','purchase_orders']); r jsonb;
BEGIN
  SELECT jsonb_build_object('summary','purchase_order_details','currency','NGN','as_of',now(),
   'purchase_orders', coalesce(jsonb_agg(x ORDER BY (x->>'days_overdue')::int DESC NULLS LAST),'[]'))
  INTO r FROM (
    SELECT jsonb_build_object(
      'po_number',po.po_number,'status',po.status,'order_date',po.order_date,'expected_date',po.expected_date,
      'days_overdue', CASE WHEN po.status IN ('approved','sent','partially_received') AND po.expected_date<current_date THEN current_date-po.expected_date END,
      'total',po.total_amount,'payment_terms',po.payment_terms,'rejection_reason',po.rejection_reason,
      'vendor',jsonb_build_object('name',v.name,'code',v.code,'categories',v.service_categories,'phone',v.phone,'email',v.email,'city',v.city),
      'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('description',coalesce(l.description,i.name),'qty',l.quantity,'unit_price',l.unit_price,'line_total',l.line_total,'qty_received',l.qty_received) ORDER BY l.line_number),'[]')
               FROM purchase_order_lines l LEFT JOIN items i ON i.id=l.item_id WHERE l.po_id=po.id)) x
    FROM purchase_orders po LEFT JOIN vendors v ON v.id=po.vendor_id
    WHERE po.organization_id=v_org AND po.status NOT IN ('closed','cancelled')
    ORDER BY po.updated_at DESC LIMIT 30) s;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ai_purchase_order_details() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_purchase_order_details() TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_vendor_directory()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['vendors','purchase_orders','procurement_dashboard']); r jsonb;
BEGIN
  SELECT jsonb_build_object('summary','vendor_directory','as_of',now(),'vendors',coalesce(jsonb_agg(jsonb_build_object(
    'name',name,'code',code,'status',status,'categories',service_categories,'phone',phone,'email',email,'city',city,
    'blacklist_status',blacklist_status) ORDER BY name),'[]'))
  INTO r FROM (SELECT * FROM vendors WHERE organization_id=v_org ORDER BY name LIMIT 100) v;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.ai_vendor_directory() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_vendor_directory() TO authenticated;