import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import type { AppRole } from '@/lib/supabase';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole | ''>('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password, full_name: fullName, role: role || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`User ${email} created successfully`);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('');
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
          <DialogTitle>Create New User</DialogTitle>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Initial Role (optional)</Label>
            <Select value={role} onValueChange={v => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="No role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="procurement_manager">Procurement Manager</SelectItem>
                <SelectItem value="procurement_officer">Procurement Officer</SelectItem>
                <SelectItem value="warehouse_manager">Warehouse Manager</SelectItem>
                <SelectItem value="warehouse_officer">Warehouse Officer</SelectItem>
                <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                <SelectItem value="ap_clerk">AP Clerk</SelectItem>
                <SelectItem value="requisitioner">Requisitioner</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
