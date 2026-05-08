import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const SYSTEM_ROLES = [
  'admin',
  'procurement_manager',
  'procurement_officer',
  'warehouse_manager',
  'warehouse_officer',
  'accounts_payable',
  'ap_clerk',
  'requisitioner',
  'viewer',
];

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  // Format: "app:<role>" or "custom:<roleId>"
  const [roleSelection, setRoleSelection] = useState<string>('none');
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('roles').select('id, name').order('name');
      setCustomRoles((data || []) as any);
    })();
  }, [open]);

  const handleCreate = async () => {
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    try {
      const isCustom = roleSelection.startsWith('custom:');
      const isApp = roleSelection.startsWith('app:');
      const appRole = isApp ? roleSelection.slice(4) : undefined;
      const customRoleId = isCustom ? roleSelection.slice(7) : undefined;

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, full_name: fullName, role: appRole, custom_role_id: customRoleId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Invite sent to ${email}.`);
      setEmail('');
      setFullName('');
      setRoleSelection('none');
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <p className="text-sm text-muted-foreground">
            An invite email will be sent with a link to set their password.
          </p>
          <div className="space-y-2">
            <Label>Initial Role (optional)</Label>
            <Select value={roleSelection} onValueChange={setRoleSelection}>
              <SelectTrigger>
                <SelectValue placeholder="No role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                <SelectGroup>
                  <SelectLabel>System Roles</SelectLabel>
                  {SYSTEM_ROLES.map(r => (
                    <SelectItem key={r} value={`app:${r}`}>
                      {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {customRoles.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Custom Roles</SelectLabel>
                    {customRoles.map(r => (
                      <SelectItem key={r.id} value={`custom:${r.id}`}>{r.name}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
