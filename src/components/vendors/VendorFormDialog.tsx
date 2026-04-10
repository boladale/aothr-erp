import { useState } from 'react';
import { Building2, Upload, X, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId?: string;
  editVendor?: import('@/lib/supabase').Vendor | null;
}

const SERVICE_CATEGORIES = [
  'Construction',
  'IT Services',
  'Consulting',
  'Manufacturing',
  'Logistics',
  'Maintenance',
  'Supplies',
  'Professional Services',
  'Equipment Rental',
  'Catering',
];

const DOCUMENT_TYPES = [
  { value: 'cac', label: 'CAC Certificate' },
  { value: 'tax_id', label: 'Tax ID / TIN' },
  { value: 'vat', label: 'VAT Certificate' },
  { value: 'bank_reference', label: 'Bank Reference Letter' },
  { value: 'insurance', label: 'Insurance Certificate' },
  { value: 'other', label: 'Other Document' },
];

interface PendingDocument {
  file: File;
  type: string;
}

export function VendorFormDialog({ open, onOpenChange, onSuccess, userId, editVendor }: VendorFormDialogProps) {
  const { organizationId } = useAuth();
  const isEdit = !!editVendor;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    rc_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    payment_terms: 30,
    service_categories: [] as string[],
    project_size_capacity: 'medium' as 'small' | 'medium' | 'large' | 'enterprise',
    bank_name: '',
    bank_account_number: '',
  });

  // Populate form when editing
  useState(() => {});
  // Use effect-like pattern via open + editVendor
  const prevEditRef = useState<string | null>(null);
  if (open && editVendor && prevEditRef[0] !== editVendor.id) {
    prevEditRef[1](editVendor.id);
    setForm({
      code: editVendor.code,
      name: editVendor.name,
      rc_number: (editVendor as any).rc_number || '',
      email: editVendor.email || '',
      phone: editVendor.phone || '',
      address: editVendor.address || '',
      city: editVendor.city || '',
      country: editVendor.country || '',
      payment_terms: editVendor.payment_terms || 30,
      service_categories: editVendor.service_categories || [],
      project_size_capacity: editVendor.project_size_capacity || 'medium',
      bank_name: editVendor.bank_name || '',
      bank_account_number: editVendor.bank_account_number || '',
    });
  }
  if (!open && prevEditRef[0] !== null) {
    prevEditRef[1](null);
  }
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const handleCategoryToggle = (category: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      service_categories: checked
        ? [...prev.service_categories, category]
        : prev.service_categories.filter(c => c !== category)
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setPendingDocuments(prev => [...prev, { file, type: docType }]);
    }
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setPendingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDocuments = async (vendorId: string) => {
    for (const doc of pendingDocuments) {
      const fileExt = doc.file.name.split('.').pop();
      const filePath = `${vendorId}/${doc.type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(filePath, doc.file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('vendor-documents')
        .getPublicUrl(filePath);

      await supabase.from('vendor_documents').insert({
        vendor_id: vendorId,
        document_type: doc.type,
        file_name: doc.file.name,
        file_url: urlData.publicUrl,
        uploaded_by: userId,
      });
    }
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and Name are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        payment_terms: form.payment_terms,
        service_categories: form.service_categories,
        project_size_capacity: form.project_size_capacity,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
      };

      if (isEdit && editVendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', editVendor.id);
        if (error) throw error;

        if (pendingDocuments.length > 0) {
          setUploadingDocs(true);
          await uploadDocuments(editVendor.id);
        }

        toast.success('Vendor updated');
      } else {
        const { data: vendor, error } = await supabase.from('vendors').insert({
          ...payload,
          created_by: userId,
          organization_id: organizationId,
        }).select('id').single();

        if (error) throw error;

        if (pendingDocuments.length > 0 && vendor) {
          setUploadingDocs(true);
          await uploadDocuments(vendor.id);
        }

        toast.success('Vendor created');
      }

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save vendor';
      toast.error(message);
    } finally {
      setSaving(false);
      setUploadingDocs(false);
    }
  };

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      rc_number: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      payment_terms: 30,
      service_categories: [],
      project_size_capacity: 'medium',
      bank_name: '',
      bank_account_number: '',
    });
    setPendingDocuments([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> {isEdit ? 'Edit Vendor' : 'New Vendor'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VND001"
              />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Vendor Name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="vendor@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </div>

          {/* Service Categories */}
          <div className="space-y-2">
            <Label>Service/Product Categories</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
              {SERVICE_CATEGORIES.map(category => (
                <div key={category} className="flex items-center gap-2">
                  <Checkbox
                    id={category}
                    checked={form.service_categories.includes(category)}
                    onCheckedChange={(checked) => handleCategoryToggle(category, checked as boolean)}
                  />
                  <Label htmlFor={category} className="text-sm font-normal cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Project Size */}
          <div className="space-y-2">
            <Label>Project Size Capacity</Label>
            <Select
              value={form.project_size_capacity}
              onValueChange={(value: 'small' | 'medium' | 'large' | 'enterprise') =>
                setForm({ ...form, project_size_capacity: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (up to ₦50M)</SelectItem>
                <SelectItem value="medium">Medium (₦50M - ₦500M)</SelectItem>
                <SelectItem value="large">Large (₦500M - ₦5B)</SelectItem>
                <SelectItem value="enterprise">Enterprise (₦5B+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={form.bank_name}
                onChange={e => setForm({ ...form, bank_name: e.target.value })}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={form.bank_account_number}
                onChange={e => setForm({ ...form, bank_account_number: e.target.value })}
                placeholder="Account number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Terms (days)</Label>
            <Input
              type="number"
              value={form.payment_terms}
              onChange={e => setForm({ ...form, payment_terms: parseInt(e.target.value) || 30 })}
            />
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <Label>Documents</Label>
            <div className="p-3 border rounded-md space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_TYPES.map(docType => (
                  <div key={docType.value} className="relative">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleFileSelect(e, docType.value)}
                      className="hidden"
                      id={`doc-${docType.value}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => document.getElementById(`doc-${docType.value}`)?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {docType.label}
                    </Button>
                  </div>
                ))}
              </div>

              {pendingDocuments.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Pending Uploads</Label>
                  {pendingDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[200px]">{doc.file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({DOCUMENT_TYPES.find(t => t.value === doc.type)?.label})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploadingDocs}>
            {uploadingDocs ? 'Uploading...' : saving ? 'Saving...' : isEdit ? 'Update Vendor' : 'Create Vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
