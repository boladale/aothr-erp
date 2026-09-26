CREATE OR REPLACE FUNCTION public.ai_demo_questions(p_days integer DEFAULT 30)
RETURNS TABLE(asked_at timestamptz, conversation_id uuid, question text, answer text, tools_used text[], weak boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.created_at, q.conversation_id, q.content, a.content, a.tools_used,
    (a.content IS NULL OR a.content ~* '(cannot|can''t|couldn''t|unable|not available|don''t have access|no data|not find|⚠️)')
  FROM ai_messages q
  JOIN profiles dp ON dp.user_id = q.user_id AND dp.email = 'demo@aothr.com'
  LEFT JOIN LATERAL (
    SELECT m.content, m.tools_used FROM ai_messages m
    WHERE m.conversation_id = q.conversation_id AND m.role = 'assistant' AND m.created_at >= q.created_at
    ORDER BY m.created_at LIMIT 1) a ON true
  WHERE q.role = 'user'
    AND q.created_at >= now() - make_interval(days => p_days)
    AND public.has_role(auth.uid(), 'admin')
    AND dp.organization_id = public.get_user_org_id()
  ORDER BY q.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.ai_demo_questions(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_demo_questions(integer) TO authenticated;