ALTER TABLE public.gl_journal_entries
  DROP CONSTRAINT IF EXISTS gl_journal_entries_entry_number_key;

ALTER TABLE public.gl_journal_entries
  ADD CONSTRAINT gl_journal_entries_org_entry_number_key UNIQUE (organization_id, entry_number);