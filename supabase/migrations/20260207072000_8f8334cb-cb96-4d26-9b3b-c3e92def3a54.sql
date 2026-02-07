-- Add new columns to vendors table
ALTER TABLE public.vendors
ADD COLUMN service_categories text[] DEFAULT '{}',
ADD COLUMN project_size_capacity text DEFAULT 'medium',
ADD COLUMN bank_name text,
ADD COLUMN bank_account_number text;

-- Add check constraint for project size
ALTER TABLE public.vendors
ADD CONSTRAINT vendors_project_size_check 
CHECK (project_size_capacity IN ('small', 'medium', 'large', 'enterprise'));

-- Create vendor_documents table for file attachments
CREATE TABLE public.vendor_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on vendor_documents
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_documents
CREATE POLICY "Auth users can view vendor_documents"
ON public.vendor_documents
FOR SELECT
USING (true);

CREATE POLICY "Auth users can manage vendor_documents"
ON public.vendor_documents
FOR ALL
USING (true)
WITH CHECK (true);

-- Create storage bucket for vendor documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vendor documents
CREATE POLICY "Auth users can upload vendor documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vendor-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can view vendor documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vendor-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete vendor documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'vendor-documents' AND auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON COLUMN public.vendors.service_categories IS 'Array of service/product categories the vendor provides';
COMMENT ON COLUMN public.vendors.project_size_capacity IS 'Size of projects vendor can handle: small, medium, large, enterprise';
COMMENT ON COLUMN public.vendors.bank_name IS 'Vendor bank name for payments';
COMMENT ON COLUMN public.vendors.bank_account_number IS 'Vendor bank account number';
COMMENT ON TABLE public.vendor_documents IS 'Stores references to vendor documents like CAC, Tax ID certificates';