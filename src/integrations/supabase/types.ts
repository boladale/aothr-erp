export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ap_invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          item_id: string
          line_total: number | null
          po_line_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          item_id: string
          line_total?: number | null
          po_line_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          invoice_id?: string
          item_id?: string
          line_total?: number | null
          po_line_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ap_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_invoice_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          po_id: string
          posted_at: string | null
          posted_by: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          po_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          po_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          acted_at: string
          action: Database["public"]["Enums"]["approval_action_type"]
          actor_id: string | null
          comments: string | null
          id: string
          instance_id: string
          step_id: string | null
          step_order: number
        }
        Insert: {
          acted_at?: string
          action: Database["public"]["Enums"]["approval_action_type"]
          actor_id?: string | null
          comments?: string | null
          id?: string
          instance_id: string
          step_id?: string | null
          step_order: number
        }
        Update: {
          acted_at?: string
          action?: Database["public"]["Enums"]["approval_action_type"]
          actor_id?: string | null
          comments?: string | null
          id?: string
          instance_id?: string
          step_id?: string | null
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "approval_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          entity_id: string
          entity_type: string
          id: string
          rule_id: string | null
          status: Database["public"]["Enums"]["approval_instance_status"]
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id: string
          entity_type: string
          id?: string
          rule_id?: string | null
          status?: Database["public"]["Enums"]["approval_instance_status"]
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id?: string
          entity_type?: string
          id?: string
          rule_id?: string | null
          status?: Database["public"]["Enums"]["approval_instance_status"]
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_instances_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "approval_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rules: {
        Row: {
          conditions: Json
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          priority: number
          rule_name: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          entity_type: string
          id?: string
          is_active?: boolean
          priority?: number
          rule_name: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          priority?: number
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      approval_steps: {
        Row: {
          approver_role: Database["public"]["Enums"]["app_role"] | null
          approver_user_id: string | null
          created_at: string
          delegation_user_id: string | null
          id: string
          rule_id: string
          step_order: number
          step_type: Database["public"]["Enums"]["approval_step_type"]
          timeout_hours: number | null
        }
        Insert: {
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          created_at?: string
          delegation_user_id?: string | null
          id?: string
          rule_id: string
          step_order: number
          step_type?: Database["public"]["Enums"]["approval_step_type"]
          timeout_hours?: number | null
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["app_role"] | null
          approver_user_id?: string | null
          created_at?: string
          delegation_user_id?: string | null
          id?: string
          rule_id?: string
          step_order?: number
          step_type?: Database["public"]["Enums"]["approval_step_type"]
          timeout_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "approval_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      budget_consumption: {
        Row: {
          amount: number
          budget_line_id: string
          created_at: string
          id: string
          posted: boolean
          source_id: string
          source_type: Database["public"]["Enums"]["budget_source_type"]
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["budget_transaction_type"]
        }
        Insert: {
          amount: number
          budget_line_id: string
          created_at?: string
          id?: string
          posted?: boolean
          source_id: string
          source_type: Database["public"]["Enums"]["budget_source_type"]
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["budget_transaction_type"]
        }
        Update: {
          amount?: number
          budget_line_id?: string
          created_at?: string
          id?: string
          posted?: boolean
          source_id?: string
          source_type?: Database["public"]["Enums"]["budget_source_type"]
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["budget_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "budget_consumption_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          available_amount: number | null
          budget_id: string
          budgeted_amount: number
          category: string
          committed_amount: number
          consumed_amount: number
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          available_amount?: number | null
          budget_id: string
          budgeted_amount?: number
          category: string
          committed_amount?: number
          consumed_amount?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          available_amount?: number | null
          budget_id?: string
          budgeted_amount?: number
          category?: string
          committed_amount?: number
          consumed_amount?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_code: string
          created_at: string
          created_by: string | null
          end_date: string
          fiscal_year: number
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["budget_status"]
          updated_at: string
        }
        Insert: {
          budget_code: string
          created_at?: string
          created_by?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
        }
        Update: {
          budget_code?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
        }
        Relationships: []
      }
      goods_receipt_lines: {
        Row: {
          grn_id: string
          id: string
          item_id: string
          po_line_id: string
          qty_received: number
        }
        Insert: {
          grn_id: string
          id?: string
          item_id: string
          po_line_id: string
          qty_received: number
        }
        Update: {
          grn_id?: string
          id?: string
          item_id?: string
          po_line_id?: string
          qty_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          grn_number: string
          id: string
          location_id: string
          notes: string | null
          po_id: string
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grn_number: string
          id?: string
          location_id: string
          notes?: string | null
          po_id: string
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grn_number?: string
          id?: string
          location_id?: string
          notes?: string | null
          po_id?: string
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_lines: {
        Row: {
          adjustment_id: string
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          id: string
          item_id: string
          notes: string | null
          quantity: number
        }
        Insert: {
          adjustment_id: string
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
        }
        Update: {
          adjustment_id?: string
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_lines_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          posted_at: string | null
          posted_by: string | null
          reason: string | null
          status: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          id: string
          item_id: string
          last_updated: string
          location_id: string
          quantity: number
        }
        Insert: {
          id?: string
          item_id: string
          last_updated?: string
          location_id: string
          quantity?: number
        }
        Update: {
          id?: string
          item_id?: string
          last_updated?: string
          location_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          item_id: string
          location_id: string
          po_line_id: string | null
          reserved_qty: number
          status: Database["public"]["Enums"]["reservation_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          item_id: string
          location_id: string
          po_line_id?: string | null
          reserved_qty: number
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          item_id?: string
          location_id?: string
          po_line_id?: string | null
          reserved_qty?: number
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_approvals: {
        Row: {
          approval_instance_id: string | null
          approved_at: string | null
          approved_by: string | null
          comments: string | null
          created_at: string
          id: string
          invoice_id: string
          status: Database["public"]["Enums"]["approval_instance_status"]
        }
        Insert: {
          approval_instance_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          status?: Database["public"]["Enums"]["approval_instance_status"]
        }
        Update: {
          approval_instance_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          status?: Database["public"]["Enums"]["approval_instance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_approvals_approval_instance_id_fkey"
            columns: ["approval_instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_approvals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_holds: {
        Row: {
          created_at: string
          hold_reason: string
          hold_type: Database["public"]["Enums"]["hold_type"]
          id: string
          invoice_id: string
          match_run_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          hold_reason: string
          hold_type: Database["public"]["Enums"]["hold_type"]
          id?: string
          invoice_id: string
          match_run_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          hold_reason?: string
          hold_type?: Database["public"]["Enums"]["hold_type"]
          id?: string
          invoice_id?: string
          match_run_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_holds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_holds_match_run_id_fkey"
            columns: ["match_run_id"]
            isOneToOne: false
            referencedRelation: "match_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      match_lines: {
        Row: {
          grn_line_id: string | null
          id: string
          invoice_line_id: string
          match_run_id: string
          match_status: Database["public"]["Enums"]["match_line_status"]
          po_line_id: string
          price_invoice: number
          price_po: number
          qty_grn: number
          qty_invoice: number
          qty_po: number
          variance_amt: number
        }
        Insert: {
          grn_line_id?: string | null
          id?: string
          invoice_line_id: string
          match_run_id: string
          match_status?: Database["public"]["Enums"]["match_line_status"]
          po_line_id: string
          price_invoice: number
          price_po: number
          qty_grn?: number
          qty_invoice: number
          qty_po: number
          variance_amt?: number
        }
        Update: {
          grn_line_id?: string | null
          id?: string
          invoice_line_id?: string
          match_run_id?: string
          match_status?: Database["public"]["Enums"]["match_line_status"]
          po_line_id?: string
          price_invoice?: number
          price_po?: number
          qty_grn?: number
          qty_invoice?: number
          qty_po?: number
          variance_amt?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_lines_grn_line_id_fkey"
            columns: ["grn_line_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lines_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "ap_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lines_match_run_id_fkey"
            columns: ["match_run_id"]
            isOneToOne: false
            referencedRelation: "match_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      match_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          match_status: Database["public"]["Enums"]["match_run_status"]
          run_date: string
          tolerance_pct: number
          total_exceptions: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          match_status?: Database["public"]["Enums"]["match_run_status"]
          run_date?: string
          tolerance_pct?: number
          total_exceptions?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          match_status?: Database["public"]["Enums"]["match_run_status"]
          run_date?: string
          tolerance_pct?: number
          total_exceptions?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_runs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      po_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          comments: string | null
          created_at: string
          id: string
          po_id: string
          rejected_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          po_id: string
          rejected_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          po_id?: string
          rejected_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_approvals_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_requisition_lines: {
        Row: {
          created_at: string
          id: string
          po_line_id: string
          quantity: number
          requisition_line_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          po_line_id: string
          quantity: number
          requisition_line_id: string
        }
        Update: {
          created_at?: string
          id?: string
          po_line_id?: string
          quantity?: number
          requisition_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_line_requisition_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_requisition_lines_requisition_line_id_fkey"
            columns: ["requisition_line_id"]
            isOneToOne: false
            referencedRelation: "requisition_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          description: string | null
          id: string
          item_id: string
          line_number: number
          line_total: number | null
          po_id: string
          qty_invoiced: number | null
          qty_received: number | null
          quantity: number
          unit_price: number
        }
        Insert: {
          description?: string | null
          id?: string
          item_id: string
          line_number: number
          line_total?: number | null
          po_id: string
          qty_invoiced?: number | null
          qty_received?: number | null
          quantity: number
          unit_price: number
        }
        Update: {
          description?: string | null
          id?: string
          item_id?: string
          line_number?: number
          line_total?: number | null
          po_id?: string
          qty_invoiced?: number | null
          qty_received?: number | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          close_ready: boolean | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          sent_at: string | null
          ship_to_location_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          close_ready?: boolean | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          sent_at?: string | null
          ship_to_location_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          close_ready?: boolean | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          sent_at?: string | null
          ship_to_location_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_ship_to_location_id_fkey"
            columns: ["ship_to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          item_id: string
          last_checked_at: string | null
          lead_time_days: number
          location_id: string
          reorder_point: number
          reorder_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          item_id: string
          last_checked_at?: string | null
          lead_time_days?: number
          location_id: string
          reorder_point?: number
          reorder_qty?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          item_id?: string
          last_checked_at?: string | null
          lead_time_days?: number
          location_id?: string
          reorder_point?: number
          reorder_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_rules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_lines: {
        Row: {
          created_at: string
          estimated_total: number | null
          estimated_unit_cost: number | null
          id: string
          item_id: string
          line_number: number
          qty_converted: number
          quantity: number
          requisition_id: string
          specifications: string | null
        }
        Insert: {
          created_at?: string
          estimated_total?: number | null
          estimated_unit_cost?: number | null
          id?: string
          item_id: string
          line_number: number
          qty_converted?: number
          quantity: number
          requisition_id: string
          specifications?: string | null
        }
        Update: {
          created_at?: string
          estimated_total?: number | null
          estimated_unit_cost?: number | null
          id?: string
          item_id?: string
          line_number?: number
          qty_converted?: number
          quantity?: number
          requisition_id?: string
          specifications?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          justification: string | null
          needed_by_date: string | null
          notes: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          req_number: string
          requester_id: string
          status: Database["public"]["Enums"]["requisition_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          justification?: string | null
          needed_by_date?: string | null
          notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          req_number: string
          requester_id: string
          status?: Database["public"]["Enums"]["requisition_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          justification?: string | null
          needed_by_date?: string | null
          notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          req_number?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          comments: string | null
          created_at: string
          id: string
          rejected_at: string | null
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_approvals_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          title: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          title?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          title?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          payment_terms: number | null
          phone: string | null
          project_size_capacity: string | null
          service_categories: string[] | null
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          payment_terms?: number | null
          phone?: string | null
          project_size_capacity?: string | null
          service_categories?: string[] | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          payment_terms?: number | null
          phone?: string | null
          project_size_capacity?: string | null
          service_categories?: string[] | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      run_three_way_match: { Args: { p_invoice_id: string }; Returns: string }
    }
    Enums: {
      adjustment_type: "increase" | "decrease"
      app_role:
        | "admin"
        | "procurement_manager"
        | "warehouse_manager"
        | "accounts_payable"
        | "viewer"
      approval_action_type: "approved" | "rejected" | "delegated" | "escalated"
      approval_instance_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
      approval_step_type: "sequential" | "parallel" | "any_of"
      budget_source_type: "po_commitment" | "invoice_actual"
      budget_status: "draft" | "active" | "closed" | "frozen"
      budget_transaction_type: "commit" | "uncommit" | "consume" | "reverse"
      hold_type:
        | "match_exception"
        | "approval_pending"
        | "budget_exceeded"
        | "manual"
      match_line_status:
        | "matched"
        | "qty_exception"
        | "price_exception"
        | "missing_grn"
        | "missing_invoice"
      match_run_status: "pending" | "matched" | "exceptions_found" | "resolved"
      po_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent"
        | "partially_received"
        | "fully_received"
        | "closed"
      requisition_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
        | "partially_converted"
        | "fully_converted"
      reservation_status: "active" | "fulfilled" | "cancelled" | "expired"
      vendor_status: "draft" | "pending_approval" | "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_type: ["increase", "decrease"],
      app_role: [
        "admin",
        "procurement_manager",
        "warehouse_manager",
        "accounts_payable",
        "viewer",
      ],
      approval_action_type: ["approved", "rejected", "delegated", "escalated"],
      approval_instance_status: [
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "cancelled",
      ],
      approval_step_type: ["sequential", "parallel", "any_of"],
      budget_source_type: ["po_commitment", "invoice_actual"],
      budget_status: ["draft", "active", "closed", "frozen"],
      budget_transaction_type: ["commit", "uncommit", "consume", "reverse"],
      hold_type: [
        "match_exception",
        "approval_pending",
        "budget_exceeded",
        "manual",
      ],
      match_line_status: [
        "matched",
        "qty_exception",
        "price_exception",
        "missing_grn",
        "missing_invoice",
      ],
      match_run_status: ["pending", "matched", "exceptions_found", "resolved"],
      po_status: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "partially_received",
        "fully_received",
        "closed",
      ],
      requisition_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
        "partially_converted",
        "fully_converted",
      ],
      reservation_status: ["active", "fulfilled", "cancelled", "expired"],
      vendor_status: ["draft", "pending_approval", "active", "inactive"],
    },
  },
} as const
