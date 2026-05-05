ALTER TABLE public.requisition_bid_entries REPLICA IDENTITY FULL;
ALTER TABLE public.bid_invitations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisition_bid_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_invitations;