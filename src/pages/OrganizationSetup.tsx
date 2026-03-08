import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Building2, Plus, LogIn } from 'lucide-react';

export default function OrganizationSetup() {
  const navigate = useNavigate();
  const { user, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('create');

  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
  });

  const [joinCode, setJoinCode] = useState('');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!createForm.name || !createForm.code) {
      toast.error('Organization name and code are required');
      return;
    }

    setLoading(true);
    try {
      // Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: createForm.name,
          code: createForm.code.toUpperCase(),
          email: createForm.email || null,
          phone: createForm.phone || null,
          address: createForm.address || null,
          city: createForm.city || null,
          country: createForm.country || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (orgError) {
        if (orgError.message.includes('duplicate')) {
          toast.error('Organization code already exists. Please choose a different one.');
        } else {
          toast.error(orgError.message);
        }
        return;
      }

      // Update the user's profile with the organization_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: org.id })
        .eq('user_id', user.id);

      if (profileError) {
        toast.error('Failed to link profile to organization');
        return;
      }

      // Give the creator the admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Failed to assign admin role:', roleError);
      }

      await refreshProfile();
      toast.success('Organization created! You are now the admin.');
      navigate('/');
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!joinCode) {
      toast.error('Please enter an organization code');
      return;
    }

    setLoading(true);
    try {
      // Find organization by code
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (orgError || !org) {
        toast.error('Organization not found. Please check the code and try again.');
        setLoading(false);
        return;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: org.id })
        .eq('user_id', user.id);

      if (profileError) {
        toast.error('Failed to join organization');
        return;
      }

      await refreshProfile();
      toast.success(`Joined ${org.name}! Contact your admin to assign roles.`);
      navigate('/');
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Organization Setup</CardTitle>
            <CardDescription className="mt-2">
              Create a new organization or join an existing one to get started.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                <Plus className="h-4 w-4 mr-1" /> Create New
              </TabsTrigger>
              <TabsTrigger value="join">
                <LogIn className="h-4 w-4 mr-1" /> Join Existing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-6">
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name *</Label>
                    <Input
                      id="org-name"
                      placeholder="Acme Corp"
                      value={createForm.name}
                      onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-code">Code *</Label>
                    <Input
                      id="org-code"
                      placeholder="ACME"
                      value={createForm.code}
                      onChange={e => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-email">Email</Label>
                    <Input
                      id="org-email"
                      type="email"
                      placeholder="info@acme.com"
                      value={createForm.email}
                      onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-phone">Phone</Label>
                    <Input
                      id="org-phone"
                      placeholder="+1 555 0100"
                      value={createForm.phone}
                      onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-address">Address</Label>
                  <Input
                    id="org-address"
                    placeholder="123 Main St"
                    value={createForm.address}
                    onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-city">City</Label>
                    <Input
                      id="org-city"
                      placeholder="New York"
                      value={createForm.city}
                      onChange={e => setCreateForm({ ...createForm, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-country">Country</Label>
                    <Input
                      id="org-country"
                      placeholder="United States"
                      value={createForm.country}
                      onChange={e => setCreateForm({ ...createForm, country: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Organization
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join" className="space-y-4 mt-6">
              <form onSubmit={handleJoinOrg} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the organization code provided by your administrator.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="join-code">Organization Code</Label>
                  <Input
                    id="join-code"
                    placeholder="ACME"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Join Organization
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t">
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}