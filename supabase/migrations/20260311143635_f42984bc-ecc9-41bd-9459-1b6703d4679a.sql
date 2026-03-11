
ALTER TABLE gl_accounts DROP CONSTRAINT gl_accounts_account_code_key;
ALTER TABLE gl_accounts ADD CONSTRAINT gl_accounts_org_account_code_key UNIQUE (organization_id, account_code);
