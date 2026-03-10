import { supabase } from '@/integrations/supabase/client';

interface SeedAccount {
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_header: boolean;
  normal_balance: string;
  description: string | null;
  parent_code?: string;
}

const BASIC_COA: SeedAccount[] = [
  // Assets
  { account_code: '1000', account_name: 'Assets', account_type: 'asset', is_header: true, normal_balance: 'debit', description: 'All asset accounts' },
  { account_code: '1100', account_name: 'Cash & Bank', account_type: 'asset', is_header: true, normal_balance: 'debit', description: 'Cash and bank accounts', parent_code: '1000' },
  { account_code: '1110', account_name: 'Petty Cash', account_type: 'asset', is_header: false, normal_balance: 'debit', description: null, parent_code: '1100' },
  { account_code: '1200', account_name: 'Bank Account', account_type: 'asset', is_header: false, normal_balance: 'debit', description: 'Main bank account', parent_code: '1100' },
  { account_code: '1300', account_name: 'Accounts Receivable', account_type: 'asset', is_header: false, normal_balance: 'debit', description: 'Trade receivables', parent_code: '1000' },
  { account_code: '1400', account_name: 'Inventory', account_type: 'asset', is_header: false, normal_balance: 'debit', description: 'Stock on hand', parent_code: '1000' },
  { account_code: '1500', account_name: 'Prepaid Expenses', account_type: 'asset', is_header: false, normal_balance: 'debit', description: null, parent_code: '1000' },
  { account_code: '1600', account_name: 'Fixed Assets', account_type: 'asset', is_header: true, normal_balance: 'debit', description: 'Property, plant & equipment', parent_code: '1000' },
  { account_code: '1610', account_name: 'Property & Equipment', account_type: 'asset', is_header: false, normal_balance: 'debit', description: null, parent_code: '1600' },
  { account_code: '1620', account_name: 'Accumulated Depreciation', account_type: 'asset', is_header: false, normal_balance: 'credit', description: 'Contra asset', parent_code: '1600' },

  // Liabilities
  { account_code: '2000', account_name: 'Liabilities', account_type: 'liability', is_header: true, normal_balance: 'credit', description: 'All liability accounts' },
  { account_code: '2100', account_name: 'Accounts Payable', account_type: 'liability', is_header: false, normal_balance: 'credit', description: 'Trade payables', parent_code: '2000' },
  { account_code: '2200', account_name: 'GRN Accrual', account_type: 'liability', is_header: false, normal_balance: 'credit', description: 'Goods received not invoiced', parent_code: '2000' },
  { account_code: '2300', account_name: 'Tax Payable', account_type: 'liability', is_header: false, normal_balance: 'credit', description: 'VAT/Sales tax payable', parent_code: '2000' },
  { account_code: '2400', account_name: 'Accrued Expenses', account_type: 'liability', is_header: false, normal_balance: 'credit', description: null, parent_code: '2000' },
  { account_code: '2500', account_name: 'Short-term Loans', account_type: 'liability', is_header: false, normal_balance: 'credit', description: null, parent_code: '2000' },

  // Equity
  { account_code: '3000', account_name: 'Equity', account_type: 'equity', is_header: true, normal_balance: 'credit', description: 'Owner equity accounts' },
  { account_code: '3100', account_name: 'Share Capital', account_type: 'equity', is_header: false, normal_balance: 'credit', description: null, parent_code: '3000' },
  { account_code: '3200', account_name: 'Retained Earnings', account_type: 'equity', is_header: false, normal_balance: 'credit', description: null, parent_code: '3000' },

  // Revenue
  { account_code: '4000', account_name: 'Revenue', account_type: 'revenue', is_header: true, normal_balance: 'credit', description: 'All revenue accounts' },
  { account_code: '4100', account_name: 'Sales Revenue', account_type: 'revenue', is_header: false, normal_balance: 'credit', description: 'Product/service sales', parent_code: '4000' },
  { account_code: '4200', account_name: 'Service Revenue', account_type: 'revenue', is_header: false, normal_balance: 'credit', description: null, parent_code: '4000' },
  { account_code: '4900', account_name: 'Other Income', account_type: 'revenue', is_header: false, normal_balance: 'credit', description: 'Miscellaneous income', parent_code: '4000' },

  // Expenses
  { account_code: '5000', account_name: 'Expenses', account_type: 'expense', is_header: true, normal_balance: 'debit', description: 'All expense accounts' },
  { account_code: '5100', account_name: 'Cost of Goods Sold', account_type: 'expense', is_header: false, normal_balance: 'debit', description: 'COGS', parent_code: '5000' },
  { account_code: '5200', account_name: 'Salaries & Wages', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5300', account_name: 'Rent Expense', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5400', account_name: 'Utilities', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5500', account_name: 'Depreciation Expense', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5600', account_name: 'Office Supplies', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5700', account_name: 'Insurance', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5800', account_name: 'Travel & Entertainment', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
  { account_code: '5900', account_name: 'Other Expenses', account_type: 'expense', is_header: false, normal_balance: 'debit', description: null, parent_code: '5000' },
];

export async function seedBasicChartOfAccounts(organizationId: string): Promise<string | null> {
  // Check if COA already exists for this org
  const { count } = await supabase
    .from('gl_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (count && count > 0) {
    return 'Chart of Accounts already exists for this organization.';
  }

  // Insert in order: headers first (no parent), then children
  // We need to resolve parent_code -> parent_id
  const codeToId = new Map<string, string>();

  // Insert top-level accounts first (no parent_code)
  const topLevel = BASIC_COA.filter(a => !a.parent_code);
  for (const acct of topLevel) {
    const { data, error } = await supabase
      .from('gl_accounts')
      .insert({
        account_code: acct.account_code,
        account_name: acct.account_name,
        account_type: acct.account_type as any,
        is_header: acct.is_header,
        normal_balance: acct.normal_balance,
        description: acct.description,
        organization_id: organizationId,
        parent_id: null,
      })
      .select('id')
      .single();

    if (error) return error.message;
    if (data) codeToId.set(acct.account_code, data.id);
  }

  // Insert child accounts
  const children = BASIC_COA.filter(a => a.parent_code);
  for (const acct of children) {
    const parentId = codeToId.get(acct.parent_code!) || null;
    const { data, error } = await supabase
      .from('gl_accounts')
      .insert({
        account_code: acct.account_code,
        account_name: acct.account_name,
        account_type: acct.account_type as any,
        is_header: acct.is_header,
        normal_balance: acct.normal_balance,
        description: acct.description,
        organization_id: organizationId,
        parent_id: parentId,
      })
      .select('id')
      .single();

    if (error) return error.message;
    if (data) codeToId.set(acct.account_code, data.id);
  }

  return null;
}
