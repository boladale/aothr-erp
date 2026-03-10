import { useEffect, useState } from 'react';
import { Users, Shield, History, UserPlus, Database, Palette, Plus, Trash2, UserX, UserCheck } from 'lucide-react';
import { OrganizationBranding } from '@/components/admin/OrganizationBranding';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataManagementPanel } from '@/components/admin/DataManagementPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Profile, UserRole, AuditLog, AppRole } from '@/lib/supabase';

interface UserWithRoles extends Profile {
  user_roles: { role: AppRole }[];
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('viewer');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, rolesRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      const profiles = (profilesRes.data || []) as Profile[];
      const roles = (rolesRes.data || []) as UserRole[];
      
      const usersWithRoles: UserWithRoles[] = profiles.map(p => ({
        ...p,
        user_roles: roles.filter(r => r.user_id === p.user_id).map(r => ({ role: r.role }))
      }));
      
      setUsers(usersWithRoles);
      setAuditLogs((logsRes.data || []) as AuditLog[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: selectedUser.user_id,
        role: newRole,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('User already has this role');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Role added');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add role');
    }
  };

  const handleManageUser = async (userId: string, action: 'delete' | 'deactivate' | 'activate') => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action, target_user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} user`);
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
      toast.success('Role removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-destructive text-destructive-foreground',
    procurement_manager: 'bg-primary text-primary-foreground',
    procurement_officer: 'bg-primary/80 text-primary-foreground',
    warehouse_manager: 'bg-info text-info-foreground',
    warehouse_officer: 'bg-info/80 text-info-foreground',
    accounts_payable: 'bg-success text-success-foreground',
    ap_clerk: 'bg-success/80 text-success-foreground',
    requisitioner: 'bg-accent text-accent-foreground',
    viewer: 'bg-muted text-muted-foreground',
  };

  const userColumns = [
    { 
      key: 'email', 
      header: 'Email', 
      render: (u: UserWithRoles) => (
        <span className={`font-medium ${!u.is_active ? 'text-muted-foreground line-through' : ''}`}>{u.email}</span>
      )
    },
    { key: 'full_name', header: 'Name', render: (u: UserWithRoles) => u.full_name || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (u: UserWithRoles) => (
        <Badge className={u.is_active ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
          {u.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { 
      key: 'roles', 
      header: 'Roles', 
      render: (u: UserWithRoles) => (
        <div className="flex flex-wrap gap-1">
          {u.user_roles.map(r => (
            <Badge key={r.role} className={roleColors[r.role]}>
              {r.role.replace(/_/g, ' ')}
              {isAdmin && (
                <button 
                  className="ml-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleRemoveRole(u.user_id, r.role); }}
                >
                  ×
                </button>
              )}
            </Badge>
          ))}
        </div>
      )
    },
    { 
      key: 'created_at', 
      header: 'Joined', 
      render: (u: UserWithRoles) => new Date(u.created_at).toLocaleDateString() 
    },
    {
      key: 'actions',
      header: '',
      render: (u: UserWithRoles) => isAdmin && (
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setSelectedUser(u); setDialogOpen(true); }}
          >
            <UserPlus className="h-4 w-4 mr-1" /> Add Role
          </Button>
          <Button
            size="sm"
            variant={u.is_active ? 'outline' : 'default'}
            onClick={(e) => { e.stopPropagation(); handleManageUser(u.user_id, u.is_active ? 'deactivate' : 'activate'); }}
          >
            {u.is_active ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
            {u.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); setUserToDelete(u); setDeleteConfirmOpen(true); }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      )
    }
  ];

  const auditColumns = [
    { 
      key: 'created_at', 
      header: 'Time', 
      render: (l: AuditLog) => new Date(l.created_at).toLocaleString() 
    },
    { key: 'entity_type', header: 'Entity', render: (l: AuditLog) => l.entity_type.replace(/_/g, ' ') },
    { key: 'action', header: 'Action', render: (l: AuditLog) => (
      <Badge variant="outline">{l.action}</Badge>
    )},
    { key: 'entity_id', header: 'Entity ID', render: (l: AuditLog) => (
      <span className="font-mono text-xs">{l.entity_id.slice(0, 8)}...</span>
    )},
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Administration"
          description="Manage users, roles, and view audit logs"
        />

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" /> Audit Log
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="data" className="gap-2">
                <Database className="h-4 w-4" /> Data Management
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="h-4 w-4" /> Branding
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> User Management
                </CardTitle>
                {isAdmin && (
                  <Button onClick={() => setCreateUserOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create User
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={userColumns}
                  data={users}
                  loading={loading}
                  emptyMessage="No users found"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(roleColors).map(([role, color]) => (
                    <div key={role} className="p-4 border rounded-lg">
                      <Badge className={color}>{role.replace(/_/g, ' ')}</Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {role === 'admin' && 'Full system access, user management, audit logs'}
                        {role === 'procurement_manager' && 'Approve vendors, POs, RFPs — management level'}
                        {role === 'procurement_officer' && 'Create and submit vendors, POs, RFPs — cannot approve'}
                        {role === 'warehouse_manager' && 'Approve GRNs, inventory adjustments — management level'}
                        {role === 'warehouse_officer' && 'Create and submit GRNs, adjustments — cannot approve'}
                        {role === 'accounts_payable' && 'Approve and post invoices — management level'}
                        {role === 'ap_clerk' && 'Create and submit invoices — cannot approve or post'}
                        {role === 'requisitioner' && 'Create and submit purchase requisitions only'}
                        {role === 'viewer' && 'Read-only access to all data'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" /> Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={auditColumns}
                  data={auditLogs}
                  loading={loading}
                  emptyMessage="No audit logs found"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="data" className="space-y-4">
              <DataManagementPanel />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="branding" className="space-y-4">
              <OrganizationBranding />
            </TabsContent>
          )}
        </Tabs>

        <CreateUserDialog open={createUserOpen} onOpenChange={setCreateUserOpen} onCreated={fetchData} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Role to {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Select Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="procurement_manager">Procurement Manager (Approver)</SelectItem>
                  <SelectItem value="procurement_officer">Procurement Officer (Initiator)</SelectItem>
                  <SelectItem value="warehouse_manager">Warehouse Manager (Approver)</SelectItem>
                  <SelectItem value="warehouse_officer">Warehouse Officer (Initiator)</SelectItem>
                  <SelectItem value="accounts_payable">Accounts Payable (Approver)</SelectItem>
                  <SelectItem value="ap_clerk">AP Clerk (Initiator)</SelectItem>
                  <SelectItem value="requisitioner">Requisitioner</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRole}>Add Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
