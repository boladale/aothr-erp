import { useEffect, useState } from 'react';
import { Shield, Plus, Trash2, Key, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/hooks/useAuth';
import type { Profile, AppRole } from '@/lib/supabase';

interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Permission {
  id: string;
  code: string;
  description: string | null;
  created_at: string;
}

interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
}

interface AppRolePermission {
  id: string;
  app_role: AppRole;
  permission_id: string;
}

interface UserWithRoles extends Profile {
  user_roles: { role: AppRole }[];
}

// Default system programs/modules
const SYSTEM_PROGRAMS: { code: string; description: string }[] = [
  { code: 'dashboard', description: 'Access to main dashboard and analytics' },
  { code: 'vendors', description: 'Manage vendors and vendor approvals' },
  { code: 'vendor_performance', description: 'View vendor performance metrics' },
  { code: 'items', description: 'Manage items catalog' },
  { code: 'locations', description: 'Manage warehouse locations' },
  { code: 'inventory', description: 'Manage inventory balances, adjustments, and reservations' },
  { code: 'purchase_orders', description: 'Create and manage purchase orders' },
  { code: 'requisitions', description: 'Create and manage procurement requisitions' },
  { code: 'rfps', description: 'Manage requests for proposals' },
  { code: 'goods_receipts', description: 'Process goods receipts (GRN)' },
  { code: 'invoices', description: 'Manage AP invoices' },
  { code: 'match_exceptions', description: 'Review three-way match exceptions' },
  { code: 'po_closure', description: 'PO closure readiness report' },
  { code: 'approval_rules', description: 'Configure approval workflows' },
  { code: 'budgets', description: 'Manage budgets and budget lines' },
  { code: 'notifications', description: 'View notifications' },
  { code: 'admin', description: 'Full admin access including user management' },
];

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [appRolePermissions, setAppRolePermissions] = useState<AppRolePermission[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');

  // Permission assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // App role programs assignment dialog
  const [appRoleAssignOpen, setAppRoleAssignOpen] = useState(false);
  const [selectedAppRole, setSelectedAppRole] = useState<AppRole | null>(null);
  const [selectedAppRolePerms, setSelectedAppRolePerms] = useState<string[]>([]);

  // User role assignment
  const [userRoleDialogOpen, setUserRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newAppRole, setNewAppRole] = useState<AppRole>('viewer');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes, rpRes, profilesRes, userRolesRes] = await Promise.all([
        supabase.from('roles').select('*').order('name'),
        supabase.from('permissions').select('*').order('code'),
        supabase.from('role_permissions').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
      ]);

      setRoles((rolesRes.data || []) as Role[]);
      setPermissions((permsRes.data || []) as Permission[]);
      setRolePermissions((rpRes.data || []) as RolePermission[]);

      const profiles = (profilesRes.data || []) as Profile[];
      const uRoles = userRolesRes.data || [];
      const usersWithRoles: UserWithRoles[] = profiles.map(p => ({
        ...p,
        user_roles: uRoles.filter(r => r.user_id === p.user_id).map(r => ({ role: r.role as AppRole })),
      }));
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Seed default permissions if none exist
  const seedPermissions = async () => {
    try {
      const existing = permissions.map(p => p.code);
      const toInsert = SYSTEM_PROGRAMS.filter(p => !existing.includes(p.code));
      if (toInsert.length === 0) {
        toast.info('All programs already exist');
        return;
      }
      const { error } = await supabase.from('permissions').insert(toInsert);
      if (error) throw error;
      toast.success(`${toInsert.length} programs added`);
      fetchData();
    } catch (error) {
      toast.error('Failed to seed programs');
    }
  };

  // Role CRUD
  const handleSaveRole = async () => {
    if (!roleName.trim()) return;
    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({ name: roleName, description: roleDescription || null })
          .eq('id', editingRole.id);
        if (error) throw error;
        toast.success('Role updated');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({ name: roleName, description: roleDescription || null });
        if (error) {
          if (error.code === '23505') {
            toast.error('Role name already exists');
            return;
          }
          throw error;
        }
        toast.success('Role created');
      }
      setRoleDialogOpen(false);
      setRoleName('');
      setRoleDescription('');
      setEditingRole(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      // Delete role_permissions first
      await supabase.from('role_permissions').delete().eq('role_id', roleToDelete.id);
      const { error } = await supabase.from('roles').delete().eq('id', roleToDelete.id);
      if (error) throw error;
      toast.success('Role deleted');
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  // Permission assignment
  const openAssignDialog = (role: Role) => {
    setSelectedRole(role);
    const assigned = rolePermissions
      .filter(rp => rp.role_id === role.id)
      .map(rp => rp.permission_id);
    setSelectedPermissions(assigned);
    setAssignDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      // Remove existing
      await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id);
      // Insert new
      if (selectedPermissions.length > 0) {
        const inserts = selectedPermissions.map(pid => ({
          role_id: selectedRole.id,
          permission_id: pid,
        }));
        const { error } = await supabase.from('role_permissions').insert(inserts);
        if (error) throw error;
      }
      toast.success('Programs assigned to role');
      setAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign programs');
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  // User role management
  const handleAddUserRole = async () => {
    if (!selectedUser || !newAppRole) return;
    try {
      const { error } = await supabase.from('user_roles').insert({
        user_id: selectedUser.user_id,
        role: newAppRole,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('User already has this role');
          return;
        }
        throw error;
      }
      toast.success('Role assigned');
      setUserRoleDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveUserRole = async (userId: string, role: AppRole) => {
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

  const getAssignedPrograms = (roleId: string) => {
    const permIds = rolePermissions.filter(rp => rp.role_id === roleId).map(rp => rp.permission_id);
    return permissions.filter(p => permIds.includes(p.id));
  };

  // Table columns
  const roleColumns = [
    { key: 'name', header: 'Role Name', render: (r: Role) => <span className="font-semibold">{r.name}</span> },
    { key: 'description', header: 'Description', render: (r: Role) => r.description || '-' },
    {
      key: 'programs',
      header: 'Assigned Programs',
      render: (r: Role) => {
        const progs = getAssignedPrograms(r.id);
        if (progs.length === 0) return <span className="text-muted-foreground text-sm">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {progs.slice(0, 5).map(p => (
              <Badge key={p.id} variant="secondary" className="text-xs">{p.code.replace(/_/g, ' ')}</Badge>
            ))}
            {progs.length > 5 && <Badge variant="outline" className="text-xs">+{progs.length - 5} more</Badge>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (r: Role) =>
        isAdmin && (
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openAssignDialog(r); }}>
              <Key className="h-4 w-4 mr-1" /> Programs
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEditingRole(r);
                setRoleName(r.name);
                setRoleDescription(r.description || '');
                setRoleDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                setRoleToDelete(r);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
    },
  ];

  const programColumns = [
    { key: 'code', header: 'Program Code', render: (p: Permission) => <Badge variant="outline">{p.code.replace(/_/g, ' ')}</Badge> },
    { key: 'description', header: 'Description', render: (p: Permission) => p.description || '-' },
    {
      key: 'assigned_to',
      header: 'Assigned To Roles',
      render: (p: Permission) => {
        const roleIds = rolePermissions.filter(rp => rp.permission_id === p.id).map(rp => rp.role_id);
        const assignedRoles = roles.filter(r => roleIds.includes(r.id));
        if (assignedRoles.length === 0) return <span className="text-muted-foreground text-sm">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {assignedRoles.map(r => (
              <Badge key={r.id} variant="secondary" className="text-xs">{r.name}</Badge>
            ))}
          </div>
        );
      },
    },
  ];

  const userColumns = [
    { key: 'email', header: 'Email', render: (u: UserWithRoles) => <span className="font-medium">{u.email}</span> },
    { key: 'full_name', header: 'Name', render: (u: UserWithRoles) => u.full_name || '-' },
    {
      key: 'roles',
      header: 'System Roles',
      render: (u: UserWithRoles) => (
        <div className="flex flex-wrap gap-1">
          {u.user_roles.map(r => (
            <Badge key={r.role} className={roleColors[r.role]}>
              {r.role.replace(/_/g, ' ')}
              {isAdmin && (
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleRemoveUserRole(u.user_id, r.role); }}
                >
                  ×
                </button>
              )}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u: UserWithRoles) => new Date(u.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (u: UserWithRoles) =>
        isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(u);
              setUserRoleDialogOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4 mr-1" /> Add Role
          </Button>
        ),
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="User Management"
          description="Create roles, assign programs to roles, and manage user access"
        />

        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" /> Roles
            </TabsTrigger>
            <TabsTrigger value="programs" className="gap-2">
              <Key className="h-4 w-4" /> Programs
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
          </TabsList>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Role Management
                </CardTitle>
                {isAdmin && (
                  <Button
                    onClick={() => {
                      setEditingRole(null);
                      setRoleName('');
                      setRoleDescription('');
                      setRoleDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Create Role
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <DataTable columns={roleColumns} data={roles} loading={loading} emptyMessage="No roles created yet" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Programs Tab */}
          <TabsContent value="programs" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" /> System Programs
                </CardTitle>
                {isAdmin && permissions.length < SYSTEM_PROGRAMS.length && (
                  <Button variant="outline" onClick={seedPermissions}>
                    <Plus className="h-4 w-4 mr-2" /> Initialize Programs
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <DataTable columns={programColumns} data={permissions} loading={loading} emptyMessage="No programs found. Click 'Initialize Programs' to add default system programs." />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> User Role Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={userColumns} data={users} loading={loading} emptyMessage="No users found" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available System Roles</CardTitle>
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
        </Tabs>

        {/* Create/Edit Role Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Role Name</Label>
                <Input
                  className="mt-1"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  placeholder="e.g. Finance Manager"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  value={roleDescription}
                  onChange={e => setRoleDescription(e.target.value)}
                  placeholder="Describe the role responsibilities..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={!roleName.trim()}>
                {editingRole ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Programs Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Assign Programs to "{selectedRole?.name}"</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              {permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No programs available. Initialize programs first.</p>
              ) : (
                permissions.map(perm => (
                  <label
                    key={perm.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedPermissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <div>
                      <p className="font-medium text-sm">{perm.code.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePermissions}>
                Save ({selectedPermissions.length} programs)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Role Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{roleToDelete?.name}"? This will also remove all program assignments for this role.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add User Role Dialog */}
        <Dialog open={userRoleDialogOpen} onOpenChange={setUserRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Role to {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>Select System Role</Label>
              <Select value={newAppRole} onValueChange={v => setNewAppRole(v as AppRole)}>
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
              <Button variant="outline" onClick={() => setUserRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUserRole}>Add Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
