-- Add new initiator/officer roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'procurement_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ap_clerk';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'requisitioner';