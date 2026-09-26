DO $$ DECLARE d text; BEGIN
 d := pg_get_functiondef('public.ai_cash_outlook'::regproc);
 d := replace(d, 'SELECT sum(amount) FROM ap_payment_allocations', 'SELECT sum(allocated_amount) FROM ap_payment_allocations');
 EXECUTE d;
 IF to_regproc('public.ai_procurement_spend') IS NOT NULL THEN
  d := pg_get_functiondef('public.ai_procurement_spend'::regproc);
  d := replace(d, 'SELECT sum(amount) FROM ap_payment_allocations', 'SELECT sum(allocated_amount) FROM ap_payment_allocations');
  EXECUTE d;
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.ai_cash_outlook() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_cash_outlook() TO authenticated;