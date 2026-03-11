
ALTER TABLE gl_fiscal_periods DROP CONSTRAINT IF EXISTS gl_fiscal_periods_fiscal_year_period_number_key;
ALTER TABLE gl_fiscal_periods ADD CONSTRAINT gl_fiscal_periods_org_year_period_key UNIQUE (organization_id, fiscal_year, period_number);
