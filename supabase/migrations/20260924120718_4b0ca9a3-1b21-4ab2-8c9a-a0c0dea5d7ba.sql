REVOKE ALL ON FUNCTION public.ai_settings_for_new_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_settings_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_can(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.ai_guard(text[]) FROM authenticated;