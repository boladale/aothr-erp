ALTER TABLE public.bid_invitations
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS payment_milestones jsonb;