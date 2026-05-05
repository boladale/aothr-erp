import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactName: z.string().min(2, 'Contact name is required'),
  rcNumber: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function VendorPortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const { user, loading: authLoading, signIn, signUp, roles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(inviteToken ? 'register' : 'login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ companyName: '', contactName: '', rcNumber: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);

  // Load invite token data
  useEffect(() => {
    if (inviteToken) {
      supabase
        .from('vendor_invite_tokens' as any)
        .select('*, vendors(name)')
        .eq('token', inviteToken)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setInviteData(data);
            setRegForm(prev => ({ ...prev, email: (data as any).email || '', companyName: (data as any).vendors?.name || '' }));
          } else {
            toast.error('Invalid or expired invite link');
          }
        });
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!authLoading && user) {
      if (roles.includes('vendor_user' as any)) {
        navigate('/vendor-portal');
      } else {
        // Check if they have a pending registration
        checkRegistrationStatus();
      }
    }
  }, [user, authLoading, roles, navigate]);

  const checkRegistrationStatus = async () => {
    if (!user) return;
    const { data } = await (supabase.from('vendor_registration_requests' as any) as any)
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.status === 'pending') {
      toast.info('Your vendor registration is pending approval.');
    } else if (data?.status === 'rejected') {
      toast.error('Your vendor registration was rejected. Please contact the organization.');
    } else if (!data) {
      // No registration and no vendor_user role - maybe they just signed up
      toast.info('Please complete your vendor registration.');
      setTab('register');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setLoading(false);
    if (error) { toast.error(error.message === 'Invalid login credentials' ? 'Invalid email or password' : error.message); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = registerSchema.safeParse(regForm);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }

    setLoading(true);

    // Invite flow: use edge function which handles existing/new auth users
    if (inviteToken && inviteData) {
      const { data, error } = await supabase.functions.invoke('vendor-accept-invite', {
        body: {
          token: inviteToken,
          email: regForm.email,
          password: regForm.password,
          contact_name: regForm.contactName,
        },
      });
      if (error || (data as any)?.error) {
        setLoading(false);
        toast.error((data as any)?.error || error?.message || 'Failed to accept invite');
        return;
      }
      // Now sign in
      const { error: signInError } = await signIn(regForm.email, regForm.password);
      setLoading(false);
      if (signInError) {
        toast.success('Account ready! Please sign in.');
        setTab('login');
      } else {
        toast.success('Welcome! Redirecting to vendor portal...');
        navigate('/vendor-portal');
      }
      return;
    }

    // Self-registration flow
    const { error: signUpError } = await signUp(regForm.email, regForm.password, regForm.contactName);
    if (signUpError) {
      setLoading(false);
      toast.error(signUpError.message);
      return;
    }

    const { error: signInError } = await signIn(regForm.email, regForm.password);
    if (signInError) {
      setLoading(false);
      toast.success('Account created! Please verify your email, then sign in to complete registration.');
      setTab('login');
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await (supabase.from('vendor_registration_requests' as any) as any).insert({
        user_id: currentUser.id,
        company_name: regForm.companyName,
        contact_name: regForm.contactName,
        rc_number: regForm.rcNumber || null,
        email: regForm.email,
        phone: regForm.phone || null,
      });
    }

    setLoading(false);
    toast.success('Registration submitted! You will be notified once approved.');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { toast.error('Please enter your email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success('Password reset email sent!');
      setForgotMode(false);
    }
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Vendor Portal</CardTitle>
            <CardDescription className="mt-2">
              Bid on RFPs, manage POs, submit invoices & documents
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
              {forgotMode ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" placeholder="vendor@company.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Reset Link
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotMode(false)}>Back to Sign In</Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="vendor@company.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign In
                  </Button>
                  <Button type="button" variant="link" className="w-full text-sm" onClick={() => setForgotMode(true)}>Forgot your password?</Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input id="company" placeholder="Acme Supplies Ltd" value={regForm.companyName} onChange={e => setRegForm({ ...regForm, companyName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rc-number">RC Number (optional)</Label>
                  <Input id="rc-number" placeholder="RC123456" value={regForm.rcNumber} onChange={e => setRegForm({ ...regForm, rcNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Person</Label>
                  <Input id="contact" placeholder="John Doe" value={regForm.contactName} onChange={e => setRegForm({ ...regForm, contactName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" placeholder="vendor@company.com" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" placeholder="+234..." value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" placeholder="••••••••" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">Confirm Password</Label>
                  <Input id="reg-confirm" type="password" placeholder="••••••••" value={regForm.confirmPassword} onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Registration
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
