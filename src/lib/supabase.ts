import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type VendorStatus = 'draft' | 'pending_approval' | 'active' | 'inactive';
export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_received' | 'fully_received' | 'closed';
export type AdjustmentType = 'increase' | 'decrease';
export type AppRole = 'admin' | 'procurement_manager' | 'warehouse_manager' | 'accounts_payable' | 'viewer';

// Phase 2 types
export type MatchLineStatus = 'matched' | 'qty_exception' | 'price_exception' | 'missing_grn' | 'missing_invoice';
export type MatchRunStatus = 'pending' | 'matched' | 'exceptions_found' | 'resolved';
export type ApprovalStepType = 'sequential' | 'parallel' | 'any_of';
export type ApprovalActionType = 'approved' | 'rejected' | 'delegated' | 'escalated';
export type ApprovalInstanceStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
export type HoldType = 'match_exception' | 'approval_pending' | 'budget_exceeded' | 'manual';
export type BudgetStatus = 'draft' | 'active' | 'closed' | 'frozen';
export type BudgetSourceType = 'po_commitment' | 'invoice_actual';
export type BudgetTransactionType = 'commit' | 'uncommit' | 'consume' | 'reverse';
export type ReservationStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';

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

// Phase 2: Three-Way Matching Types
export interface MatchRun {
  id: string;
  invoice_id: string;
  run_date: string;
  match_status: MatchRunStatus;
  tolerance_pct: number;
  total_exceptions: number;
  created_by?: string;
  created_at: string;
  invoice?: APInvoice;
}

export interface MatchLine {
  id: string;
  match_run_id: string;
  po_line_id: string;
  grn_line_id?: string;
  invoice_line_id: string;
  qty_po: number;
  qty_grn: number;
  qty_invoice: number;
  price_po: number;
  price_invoice: number;
  variance_amt: number;
  match_status: MatchLineStatus;
  po_line?: PurchaseOrderLine;
  invoice_line?: APInvoiceLine;
}

// Phase 2: Invoice Holds
export interface InvoiceHold {
  id: string;
  invoice_id: string;
  hold_type: HoldType;
  hold_reason: string;
  match_run_id?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  invoice?: APInvoice;
  match_run?: MatchRun;
}

// Phase 2: Approval Engine Types
export interface ApprovalRule {
  id: string;
  entity_type: string;
  rule_name: string;
  conditions: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  rule_id: string;
  step_order: number;
  step_type: ApprovalStepType;
  approver_role?: AppRole;
  approver_user_id?: string;
  delegation_user_id?: string;
  timeout_hours?: number;
  created_at: string;
}

export interface ApprovalInstance {
  id: string;
  rule_id?: string;
  entity_type: string;
  entity_id: string;
  current_step: number;
  status: ApprovalInstanceStatus;
  submitted_at: string;
  submitted_by?: string;
  completed_at?: string;
  created_at: string;
}

export interface ApprovalAction {
  id: string;
  instance_id: string;
  step_id?: string;
  step_order: number;
  actor_id?: string;
  action: ApprovalActionType;
  comments?: string;
  acted_at: string;
}

// Phase 2: Budgeting Types
export interface Budget {
  id: string;
  budget_code: string;
  name: string;
  fiscal_year: number;
  status: BudgetStatus;
  start_date: string;
  end_date: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetLine {
  id: string;
  budget_id: string;
  category: string;
  budgeted_amount: number;
  committed_amount: number;
  consumed_amount: number;
  available_amount: number;
  created_at: string;
  updated_at: string;
  budget?: Budget;
}

export interface BudgetConsumption {
  id: string;
  budget_line_id: string;
  source_type: BudgetSourceType;
  source_id: string;
  amount: number;
  transaction_type: BudgetTransactionType;
  transaction_date: string;
  posted: boolean;
  created_at: string;
}

// Phase 2: Inventory Extensions
export interface ReorderRule {
  id: string;
  item_id: string;
  location_id: string;
  reorder_point: number;
  reorder_qty: number;
  lead_time_days: number;
  is_active: boolean;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
  item?: Item;
  location?: Location;
}

export interface InventoryReservation {
  id: string;
  item_id: string;
  location_id: string;
  po_line_id?: string;
  reserved_qty: number;
  status: ReservationStatus;
  expires_at?: string;
  created_by?: string;
  created_at: string;
  item?: Item;
  location?: Location;
}
