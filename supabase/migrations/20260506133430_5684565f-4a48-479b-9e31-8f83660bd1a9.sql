REVOKE ALL ON FUNCTION public.is_current_vendor_user_for_vendor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_vendor_invited_to_rfp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_vendor_user_for_vendor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_vendor_invited_to_rfp(uuid) TO authenticated;