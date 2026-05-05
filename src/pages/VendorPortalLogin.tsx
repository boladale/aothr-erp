import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Store, Upload, X, FileText } from 'lucide-react';
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

const SERVICE_CATEGORIES = [
  'Construction', 'IT Services', 'Consulting', 'Manufacturing', 'Logistics',
  'Maintenance', 'Supplies', 'Professional Services', 'Equipment Rental', 'Catering',
];

const DOCUMENT_TYPES = [
  { value: 'cac', label: 'CAC Certificate' },
  { value: 'tax_id', label: 'Tax ID / TIN' },
  { value: 'vat', label: 'VAT Certificate' },
  { value: 'bank_reference', label: 'Bank Reference Letter' },
  { value: 'insurance', label: 'Insurance Certificate' },
  { value: 'other', label: 'Other Document' },
];

interface PendingDocument { file: File; type: string; }

export default function VendorPortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const { user, loading: authLoading, signIn, signUp, roles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(inviteToken ? 'register' : 'login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    companyName: '', contactName: '', rcNumber: '', email: '', phone: '',
    address: '', city: '', country: '', website: '',
    serviceCategories: [] as string[],
    projectSizeCapacity: 'medium' as 'small' | 'medium' | 'large' | 'enterprise',
    bankName: '', bankAccountNumber: '', paymentTerms: 30,
    password: '', confirmPassword: '',
  });
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);

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
        checkRegistrationStatus();
      }
    }
  }, [user, authLoading, roles, navigate]);

  const checkRegistrationStatus = async () => {
    if (!user) return;
    const { data } = await (supabase.from('vendor_registration_requests' as any) as any)
      .select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.status === 'pending') toast.info('Your vendor registration is pending approval.');
    else if (data?.status === 'rejected') toast.error('Your vendor registration was rejected. Please contact the organization.');
    else if (!data) { toast.info('Please complete your vendor registration.'); setTab('register'); }
  };

  const handleCategoryToggle = (cat: string, checked: boolean) => {
    setRegForm(prev => ({
      ...prev,
      serviceCategories: checked
        ? [...prev.serviceCategories, cat]
        : prev.serviceCategories.filter(c => c !== cat),
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) { toast.error('File size must be less than 10MB'); return; }
      setPendingDocuments(prev => [...prev, { file, type: docType }]);
    }
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setPendingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadRegistrationDocs = async (userId: string) => {
    const uploaded: { type: string; file_name: string; file_url: string }[] = [];
    for (const doc of pendingDocuments) {
      const fileExt = doc.file.name.split('.').pop();
      const filePath = `registrations/${userId}/${doc.type}_${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from('vendor-documents').upload(filePath, doc.file);
      if (upErr) { console.error(upErr); continue; }
      const { data: urlData } = supabase.storage.from('vendor-documents').getPublicUrl(filePath);
      uploaded.push({ type: doc.type, file_name: doc.file.name, file_url: urlData.publicUrl });
    }
    return uploaded;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setLoading(false);
    if (error) toast.error(error.message === 'Invalid login credentials' ? 'Invalid email or password' : error.message);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = registerSchema.safeParse(regForm);
    if (!result.success) { toast.error(result.error.errors[0].message); return; }

    setLoading(true);

    // Invite flow
    if (inviteToken && inviteData) {
      const { data, error } = await supabase.functions.invoke('vendor-accept-invite', {
        body: { token: inviteToken, email: regForm.email, password: regForm.password, contact_name: regForm.contactName },
      });
      if (error || (data as any)?.error) {
        setLoading(false);
        toast.error((data as any)?.error || error?.message || 'Failed to accept invite');
        return;
      }
      const { error: signInError } = await signIn(regForm.email, regForm.password);
      setLoading(false);
      if (signInError) { toast.success('Account ready! Please sign in.'); setTab('login'); }
      else { toast.success('Welcome! Redirecting to vendor portal...'); navigate('/vendor-portal'); }
      return;
    }

    // Self-registration
    const { error: signUpError } = await signUp(regForm.email, regForm.password, regForm.contactName);
    if (signUpError) { setLoading(false); toast.error(signUpError.message); return; }

    const { error: signInError } = await signIn(regForm.email, regForm.password);
    if (signInError) {
      setLoading(false);
      toast.success('Account created! Please verify your email, then sign in to complete registration.');
      setTab('login');
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const docs = pendingDocuments.length > 0 ? await uploadRegistrationDocs(currentUser.id) : [];
      await (supabase.from('vendor_registration_requests' as any) as any).insert({
        user_id: currentUser.id,
        company_name: regForm.companyName,
        contact_name: regForm.contactName,
        rc_number: regForm.rcNumber || null,
        email: regForm.email,
        phone: regForm.phone || null,
        address: regForm.address || null,
        city: regForm.city || null,
        country: regForm.country || null,
        website: regForm.website || null,
        service_categories: regForm.serviceCategories,
        project_size_capacity: regForm.projectSizeCapacity,
        bank_name: regForm.bankName || null,
        bank_account_number: regForm.bankAccountNumber || null,
        payment_terms: regForm.paymentTerms,
        documents: docs,
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
    if (error) toast.error(error.message);
    else { toast.success('Password reset email sent!'); setForgotMode(false); }
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg my-8">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Vendor Portal</CardTitle>
            <CardDescription className="mt-2">Bid on RFPs, manage POs, submit invoices &amp; documents</CardDescription>
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
                <form onSubmit={handleForgotPassword} className="space-y-4 max-w-md mx-auto">
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
                <form onSubmit={handleLogin} className="space-y-4 max-w-md mx-auto">
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
                <div className="text-sm font-semibold text-muted-foreground border-b pb-1">Company Information</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name *</Label>
                    <Input id="company" placeholder="Acme Supplies Ltd" value={regForm.companyName} onChange={e => setRegForm({ ...regForm, companyName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rc-number">RC Number</Label>
                    <Input id="rc-number" placeholder="RC123456" value={regForm.rcNumber} onChange={e => setRegForm({ ...regForm, rcNumber: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Person *</Label>
                    <Input id="contact" placeholder="John Doe" value={regForm.contactName} onChange={e => setRegForm({ ...regForm, contactName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email *</Label>
                    <Input id="reg-email" type="email" placeholder="vendor@company.com" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+234..." value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" placeholder="https://..." value={regForm.website} onChange={e => setRegForm({ ...regForm, website: e.target.value })} />
                  </div>
                </div>

                <div className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Address</div>
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input placeholder="Street address" value={regForm.address} onChange={e => setRegForm({ ...regForm, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={regForm.city} onChange={e => setRegForm({ ...regForm, city: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={regForm.country} onChange={e => setRegForm({ ...regForm, country: e.target.value })} />
                  </div>
                </div>

                <div className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Capability</div>
                <div className="space-y-2">
                  <Label>Service / Product Categories</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                    {SERVICE_CATEGORIES.map(cat => (
                      <div key={cat} className="flex items-center gap-2">
                        <Checkbox id={`cat-${cat}`} checked={regForm.serviceCategories.includes(cat)} onCheckedChange={(c) => handleCategoryToggle(cat, c as boolean)} />
                        <Label htmlFor={`cat-${cat}`} className="text-sm font-normal cursor-pointer">{cat}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Project Size Capacity</Label>
                  <Select value={regForm.projectSizeCapacity} onValueChange={(v: any) => setRegForm({ ...regForm, projectSizeCapacity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (up to ₦50M)</SelectItem>
                      <SelectItem value="medium">Medium (₦50M - ₦500M)</SelectItem>
                      <SelectItem value="large">Large (₦500M - ₦5B)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (₦5B+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Bank &amp; Payment</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input value={regForm.bankName} onChange={e => setRegForm({ ...regForm, bankName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={regForm.bankAccountNumber} onChange={e => setRegForm({ ...regForm, bankAccountNumber: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Payment Terms (days)</Label>
                  <Input type="number" value={regForm.paymentTerms} onChange={e => setRegForm({ ...regForm, paymentTerms: parseInt(e.target.value) || 30 })} />
                </div>

                <div className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Documents</div>
                <div className="p-3 border rounded-md space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {DOCUMENT_TYPES.map(dt => (
                      <div key={dt.value}>
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileSelect(e, dt.value)} className="hidden" id={`reg-doc-${dt.value}`} />
                        <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={() => document.getElementById(`reg-doc-${dt.value}`)?.click()}>
                          <Upload className="h-4 w-4 mr-2" />{dt.label}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {pendingDocuments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground">Pending Uploads</Label>
                      {pendingDocuments.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{doc.file.name}</span>
                            <span className="text-xs text-muted-foreground">({DOCUMENT_TYPES.find(t => t.value === doc.type)?.label})</span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDocument(i)}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">Account Credentials</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password *</Label>
                    <Input id="reg-password" type="password" placeholder="••••••••" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password *</Label>
                    <Input id="reg-confirm" type="password" placeholder="••••••••" value={regForm.confirmPassword} onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })} required />
                  </div>
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
