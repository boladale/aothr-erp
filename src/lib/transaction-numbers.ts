import { supabase } from '@/integrations/supabase/client';

export async function getNextTransactionNumber(
  organizationId: string,
  docType: string,
  prefix?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('next_transaction_number', {
    p_org_id: organizationId,
    p_doc_type: docType,
    p_prefix: prefix || docType,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
