import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BACKUP_TABLES = [
  'vendors', 'items', 'locations', 'customers',
  'gl_accounts', 'gl_fiscal_periods', 'gl_journal_entries', 'gl_journal_lines',
  'purchase_orders', 'purchase_order_lines',
  'requisitions', 'requisition_lines',
  'goods_receipts', 'goods_receipt_lines',
  'ap_invoices', 'ap_invoice_lines', 'ap_payments', 'ap_payment_allocations',
  'ar_invoices', 'ar_invoice_lines', 'ar_receipts', 'ar_receipt_allocations',
  'bank_accounts', 'bank_transactions',
  'inventory_balances', 'projects',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error('Not authenticated');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) throw new Error('Admin access required');

    const { data: profile } = await adminClient.from('profiles').select('organization_id').eq('user_id', user.id).single();
    if (!profile?.organization_id) throw new Error('No organization');

    const { action, backup_id, tables } = await req.json();

    if (action === 'create') {
      const selectedTables = tables || BACKUP_TABLES;
      const backupData: Record<string, any[]> = {};

      for (const table of selectedTables) {
        const { data, error } = await adminClient
          .from(table)
          .select('*')
          .eq('organization_id', profile.organization_id)
          .limit(10000);
        
        if (error) {
          const { data: allData } = await adminClient.from(table).select('*').limit(10000);
          backupData[table] = allData || [];
        } else {
          backupData[table] = data || [];
        }
      }

      const jsonStr = JSON.stringify(backupData, null, 2);
      const fileName = `backup-${profile.organization_id}/${Date.now()}.json`;
      
      const { error: uploadErr } = await adminClient.storage
        .from('data-backups')
        .upload(fileName, new Blob([jsonStr], { type: 'application/json' }));
      if (uploadErr) throw uploadErr;

      const { data: urlData } = adminClient.storage.from('data-backups').getPublicUrl(fileName);

      await adminClient.from('data_backups').insert({
        backup_name: `Backup ${new Date().toLocaleDateString()}`,
        tables_included: selectedTables,
        file_url: urlData.publicUrl,
        file_size: jsonStr.length,
        status: 'completed',
        created_by: user.id,
        organization_id: profile.organization_id,
        completed_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: true, message: `Backup created with ${selectedTables.length} tables` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete' && backup_id) {
      const { data: backup } = await adminClient.from('data_backups').select('*').eq('id', backup_id).single();
      if (backup?.file_url) {
        const parts = backup.file_url.split('/data-backups/');
        if (parts[1]) await adminClient.storage.from('data-backups').remove([decodeURIComponent(parts[1])]);
      }
      await adminClient.from('data_backups').delete().eq('id', backup_id);
      return new Response(JSON.stringify({ success: true, message: 'Backup deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'download' && backup_id) {
      const { data: backup } = await adminClient.from('data_backups').select('*').eq('id', backup_id).single();
      if (!backup?.file_url) throw new Error('Backup not found');
      
      const parts = backup.file_url.split('/data-backups/');
      if (!parts[1]) throw new Error('Invalid backup URL');
      
      const { data: fileData, error: dlErr } = await adminClient.storage
        .from('data-backups')
        .download(decodeURIComponent(parts[1]));
      if (dlErr) throw dlErr;
      
      const text = await fileData.text();
      return new Response(JSON.stringify({ success: true, data: JSON.parse(text) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify' && backup_id) {
      const { data: backup } = await adminClient.from('data_backups').select('*').eq('id', backup_id).single();
      if (!backup?.file_url) throw new Error('Backup not found');

      const parts = backup.file_url.split('/data-backups/');
      if (!parts[1]) throw new Error('Invalid backup URL');

      // 1. File retrievable
      const { data: fileData, error: dlErr } = await adminClient.storage
        .from('data-backups')
        .download(decodeURIComponent(parts[1]));
      if (dlErr) throw new Error(`File not retrievable: ${dlErr.message}`);

      const text = await fileData.text();

      // 2. Parses as JSON
      let parsed: Record<string, any[]>;
      try {
        parsed = JSON.parse(text);
      } catch (e: any) {
        throw new Error(`Backup file is corrupt (not valid JSON): ${e.message}`);
      }

      // 3. Row counts vs live DB
      const tableResults: Array<{ table: string; backup_count: number; live_count: number; status: 'match' | 'drift' | 'missing' }> = [];
      let totalBackupRows = 0;
      let totalLiveRows = 0;

      for (const table of backup.tables_included as string[]) {
        const backupRows = Array.isArray(parsed[table]) ? parsed[table].length : 0;
        totalBackupRows += backupRows;

        let liveCount = 0;
        const { count, error: cErr } = await adminClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id);

        if (cErr) {
          const { count: allCount } = await adminClient
            .from(table)
            .select('*', { count: 'exact', head: true });
          liveCount = allCount || 0;
        } else {
          liveCount = count || 0;
        }
        totalLiveRows += liveCount;

        let status: 'match' | 'drift' | 'missing' = 'match';
        if (!(table in parsed)) status = 'missing';
        else if (backupRows !== liveCount) status = 'drift';

        tableResults.push({ table, backup_count: backupRows, live_count: liveCount, status });
      }

      const drift = tableResults.filter(r => r.status !== 'match');
      const ok = drift.length === 0;

      return new Response(JSON.stringify({
        success: true,
        ok,
        file_size: text.length,
        table_count: (backup.tables_included as string[]).length,
        total_backup_rows: totalBackupRows,
        total_live_rows: totalLiveRows,
        drift_count: drift.length,
        tables: tableResults,
        message: ok
          ? `Backup verified: ${totalBackupRows} rows across ${tableResults.length} tables match live data.`
          : `Backup readable, but ${drift.length} of ${tableResults.length} tables have drifted since this backup was taken.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'restore' && backup_id) {
      const { dry_run } = await req.json().catch(() => ({ dry_run: true }));
      const { data: backup } = await adminClient.from('data_backups').select('*').eq('id', backup_id).single();
      if (!backup?.file_url) throw new Error('Backup not found');

      const parts = backup.file_url.split('/data-backups/');
      if (!parts[1]) throw new Error('Invalid backup URL');

      const { data: fileData, error: dlErr } = await adminClient.storage
        .from('data-backups')
        .download(decodeURIComponent(parts[1]));
      if (dlErr) throw dlErr;

      const parsed = JSON.parse(await fileData.text());
      const preview = Object.entries(parsed).map(([t, rows]) => ({ table: t, rows: (rows as any[]).length }));

      // Dry-run only. Full restore is intentionally disabled from the UI: restoring
      // rows into a live tenant risks FK conflicts and audit-trail corruption.
      // Admins should download the JSON and coordinate a supervised restore.
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        message: 'Restore preview generated. Download the JSON file for supervised restore — in-place restore is disabled to protect referential integrity.',
        preview,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
