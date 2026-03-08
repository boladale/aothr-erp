import { useState } from 'react';
import { Database, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function DataManagementPanel() {
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-data-management', {
        body: { action: 'seed' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message);
      } else {
        toast.error(data?.message || 'Failed to seed data');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setConfirmCleanup(false);
    try {
      const { data, error } = await supabase.functions.invoke('admin-data-management', {
        body: { action: 'cleanup' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message);
      } else {
        toast.error(data?.message || 'Cleanup failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cleanup data');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <>
      <Card className="border-warning/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">Seed Demo Data</h4>
              <p className="text-sm text-muted-foreground">
                Create sample requisitions, purchase orders, invoices, RFPs, sales orders, projects, and inventory balances for testing.
                Requires existing master data (vendors, items, locations).
              </p>
              <Button onClick={handleSeed} disabled={seeding} className="gap-2">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {seeding ? 'Seeding...' : 'Seed Demo Data'}
              </Button>
            </div>

            <div className="flex-1 p-4 border border-destructive/30 rounded-lg space-y-3">
              <h4 className="font-medium text-destructive">Production Cleanup</h4>
              <p className="text-sm text-muted-foreground">
                Delete all transactional data (orders, invoices, receipts, journal entries, etc.)
                while keeping setup data (items, vendors, customers, locations, GL accounts, fiscal periods, approval rules, tax config).
              </p>
              <Button
                variant="destructive"
                onClick={() => setConfirmCleanup(true)}
                disabled={cleaning}
                className="gap-2"
              >
                {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {cleaning ? 'Cleaning...' : 'Cleanup for Production'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmCleanup} onOpenChange={setConfirmCleanup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Production Cleanup
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will permanently delete ALL transactional data including:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Requisitions, Purchase Orders, and GRNs</li>
                <li>AP & AR Invoices, Payments, and Receipts</li>
                <li>RFPs and Proposals</li>
                <li>Sales Quotations, Orders, and Delivery Notes</li>
                <li>Journal Entries and GL Balances</li>
                <li>Bank Transactions and Reconciliations</li>
                <li>Inventory Balances and Adjustments</li>
                <li>Projects, Audit Logs, and Notifications</li>
              </ul>
              <p className="font-medium mt-3">Setup data (items, vendors, customers, locations, GL accounts, etc.) will be preserved.</p>
              <p className="text-destructive font-semibold">This action cannot be undone!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete All Transactional Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
