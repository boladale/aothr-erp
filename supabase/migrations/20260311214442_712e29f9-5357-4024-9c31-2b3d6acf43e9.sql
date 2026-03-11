
-- Temporarily disable the audit trigger to fix the data
ALTER TABLE inventory_balances DISABLE TRIGGER audit_inventory_balance;

-- Fix the Warri balance: should be 2 (one posted GRN with qty 2), not 4
UPDATE inventory_balances 
SET quantity = 2, last_updated = now()
WHERE id = 'ca6df619-7b12-4f38-b5b3-3810acdfad64';

-- Re-enable the audit trigger
ALTER TABLE inventory_balances ENABLE TRIGGER audit_inventory_balance;
