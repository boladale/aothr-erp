ALTER TABLE items DROP CONSTRAINT IF EXISTS items_code_key;
ALTER TABLE items ADD CONSTRAINT items_org_code_key UNIQUE (organization_id, code);