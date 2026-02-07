import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type VendorStatus = 'draft' | 'pending_approval' | 'active' | 'inactive';
export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_received' | 'fully_received' | 'closed';
export type AdjustmentType = 'increase' | 'decrease';
export type AppRole = 'admin' | 'procurement_manager' | 'warehouse_manager' | 'accounts_payable' | 'viewer';

export interface Vendor {
  id: string;
  code: string;
  name: string;
  status: VendorStatus;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  payment_terms?: number;
  service_categories?: string[];
  project_size_capacity?: 'small' | 'medium' | 'large' | 'enterprise';
  bank_name?: string;
  bank_account_number?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  uploaded_by?: string;
  created_at: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  unit_of_measure: string;
  unit_cost?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface InventoryBalance {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  last_updated: string;
  item?: Item;
  location?: Location;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  status: POStatus;
  order_date: string;
  expected_date?: string;
  ship_to_location_id?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  notes?: string;
  close_ready: boolean;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  sent_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  location?: Location;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  line_number: number;
  item_id: string;
  description?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  qty_received: number;
  qty_invoiced: number;
  item?: Item;
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_id: string;
  location_id: string;
  receipt_date: string;
  status: string;
  notes?: string;
  posted_at?: string;
  posted_by?: string;
  created_by?: string;
  created_at: string;
  purchase_order?: PurchaseOrder;
  location?: Location;
}

export interface GoodsReceiptLine {
  id: string;
  grn_id: string;
  po_line_id: string;
  item_id: string;
  qty_received: number;
  item?: Item;
  po_line?: PurchaseOrderLine;
}

export interface APInvoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  po_id: string;
  invoice_date: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  status: string;
  posted_at?: string;
  posted_by?: string;
  created_by?: string;
  created_at: string;
  vendor?: Vendor;
  purchase_order?: PurchaseOrder;
}

export interface APInvoiceLine {
  id: string;
  invoice_id: string;
  po_line_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item?: Item;
  po_line?: PurchaseOrderLine;
}

export interface Notification {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  notification_type: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  created_at: string;
}
