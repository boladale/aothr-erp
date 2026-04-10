
-- Add vendor_user and employee to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendor_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Create vendor_users table
CREATE TABLE public.vendor_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, user_id)
);

ALTER TABLE public.vendor_users ENABLE ROW LEVEL SECURITY;

-- Vendor can see their own link
CREATE POLICY "vendor_users_own_select" ON public.vendor_users
  FOR SELECT USING (auth.uid() = user_id);

-- Admins/procurement can manage vendor users in their org
CREATE POLICY "vendor_users_admin_select" ON public.vendor_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'procurement_manager')
    )
  );

CREATE POLICY "vendor_users_admin_insert" ON public.vendor_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'procurement_manager')
    )
  );

CREATE POLICY "vendor_users_admin_update" ON public.vendor_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'procurement_manager')
    )
  );

-- Create vendor_registration_requests table
CREATE TABLE public.vendor_registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  service_categories TEXT[] DEFAULT '{}',
  project_size_capacity TEXT DEFAULT 'small',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  vendor_id UUID REFERENCES public.vendors(id),
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_registration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can create a request
CREATE POLICY "vendor_reg_insert" ON public.vendor_registration_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Requesters can view their own
CREATE POLICY "vendor_reg_own_select" ON public.vendor_registration_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Admins/procurement can view all and update
CREATE POLICY "vendor_reg_admin_select" ON public.vendor_registration_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'procurement_manager')
    )
  );

CREATE POLICY "vendor_reg_admin_update" ON public.vendor_registration_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'procurement_manager')
    )
  );

-- Allow vendor_user role holders to see their own vendor documents
CREATE POLICY "vendor_docs_vendor_user_select" ON public.vendor_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_users vu
      WHERE vu.user_id = auth.uid()
      AND vu.vendor_id = vendor_documents.vendor_id
      AND vu.is_active = true
    )
  );

-- Allow vendor users to insert docs for their vendor
CREATE POLICY "vendor_docs_vendor_user_insert" ON public.vendor_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_users vu
      WHERE vu.user_id = auth.uid()
      AND vu.vendor_id = vendor_documents.vendor_id
      AND vu.is_active = true
    )
  );
