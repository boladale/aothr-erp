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
          expense_account_id: string | null
          id: string
          invoice_id: string
          item_id: string
          line_total: number | null
          po_line_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          expense_account_id?: string | null
          id?: string
          invoice_id: string
          item_id: string
          line_total?: number | null
          po_line_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          expense_account_id?: string | null
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
            foreignKeyName: "ap_invoice_lines_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
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
          currency: string
          due_date: string | null
          exchange_rate: number
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string | null
          payment_status: string
          po_id: string
          posted_at: string | null
          posted_by: string | null
          rejection_reason: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          organization_id?: string | null
          payment_status?: string
          po_id: string
          posted_at?: string | null
          posted_by?: string | null
          rejection_reason?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          organization_id?: string | null
          payment_status?: string
          po_id?: string
          posted_at?: string | null
          posted_by?: string | null
          rejection_reason?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
      ap_payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ap_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payments: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          id: string
          notes: string | null
          organization_id: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          posted_at: string | null
          posted_by: string | null
          reference_number: string | null
          status: string
          total_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string
          payment_number: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      app_role_permissions: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          id: string
          permission_id: string
        }
        Insert: {
          app_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          permission_id: string
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["approval_instance_status"]
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          priority?: number
          rule_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      ar_credit_note_lines: {
        Row: {
          credit_note_id: string
          description: string
          id: string
          item_id: string | null
          line_total: number | null
          quantity: number
          unit_price: number
        }
        Insert: {
          credit_note_id: string
          description: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          credit_note_id?: string
          description?: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "ar_credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_credit_notes: {
        Row: {
          created_at: string
          created_by: string | null
          credit_date: string
          credit_note_number: string
          currency: string
          customer_id: string
          exchange_rate: number
          id: string
          invoice_id: string | null
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          reason: string | null
          status: Database["public"]["Enums"]["ar_credit_note_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_date?: string
          credit_note_number: string
          currency?: string
          customer_id: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["ar_credit_note_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_date?: string
          credit_note_number?: string
          currency?: string
          customer_id?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["ar_credit_note_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_invoice_lines: {
        Row: {
          description: string
          id: string
          invoice_id: string
          item_id: string | null
          line_total: number | null
          quantity: number
          revenue_account_id: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          revenue_account_id?: string | null
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          revenue_account_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_invoice_lines_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string | null
          exchange_rate: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          organization_id: string | null
          payment_status: Database["public"]["Enums"]["ar_payment_status"]
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["ar_invoice_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          organization_id?: string | null
          payment_status?: Database["public"]["Enums"]["ar_payment_status"]
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["ar_invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string | null
          payment_status?: Database["public"]["Enums"]["ar_payment_status"]
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["ar_invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_receipt_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          invoice_id: string
          receipt_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          receipt_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "ar_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          exchange_rate: number
          id: string
          notes: string | null
          organization_id: string | null
          payment_method: string
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          receipt_number: string
          reference_number: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_method?: string
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          receipt_number: string
          reference_number?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_method?: string
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          receipt_number?: string
          reference_number?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string
          current_balance: number
          gl_account_id: string | null
          id: string
          is_active: boolean
          opening_balance: number
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          difference: number
          gl_balance: number
          id: string
          notes: string | null
          organization_id: string | null
          reconciled_balance: number
          reconciliation_date: string
          statement_end_date: string
          statement_ending_balance: number
          statement_start_date: string
          status: Database["public"]["Enums"]["reconciliation_status"]
        }
        Insert: {
          bank_account_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          difference?: number
          gl_balance?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          reconciled_balance?: number
          reconciliation_date?: string
          statement_end_date: string
          statement_ending_balance: number
          statement_start_date: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Update: {
          bank_account_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          difference?: number
          gl_balance?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          reconciled_balance?: number
          reconciliation_date?: string
          statement_end_date?: string
          statement_ending_balance?: number
          statement_start_date?: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gl_journal_entry_id: string | null
          id: string
          organization_id: string | null
          payee: string | null
          reconciliation_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["bank_txn_status"]
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["bank_txn_type"]
          value_date: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          payee?: string | null
          reconciliation_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_txn_status"]
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["bank_txn_type"]
          value_date?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          payee?: string | null
          reconciliation_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_txn_status"]
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["bank_txn_type"]
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_gl_journal_entry_id_fkey"
            columns: ["gl_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          payment_terms: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_backups: {
        Row: {
          backup_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          file_url: string | null
          id: string
          organization_id: string | null
          status: string
          tables_included: string[]
        }
        Insert: {
          backup_name: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          tables_included?: string[]
        }
        Update: {
          backup_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          tables_included?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "data_backups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_lines: {
        Row: {
          dn_id: string
          id: string
          item_id: string | null
          order_line_id: string
          qty_delivered: number
        }
        Insert: {
          dn_id: string
          id?: string
          item_id?: string | null
          order_line_id: string
          qty_delivered: number
        }
        Update: {
          dn_id?: string
          id?: string
          item_id?: string | null
          order_line_id?: string
          qty_delivered?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_lines_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_date: string
          dn_number: string
          id: string
          location_id: string | null
          notes: string | null
          order_id: string
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_date?: string
          dn_number: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_id: string
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_date?: string
          dn_number?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          organization_id: string | null
          rate: number
          to_currency: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency: string
          id?: string
          organization_id?: string | null
          rate: number
          to_currency: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          organization_id?: string | null
          rate?: number
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          from_bank_account_id: string
          gl_journal_entry_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["fund_transfer_status"]
          to_bank_account_id: string
          transfer_date: string
          transfer_number: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          from_bank_account_id: string
          gl_journal_entry_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["fund_transfer_status"]
          to_bank_account_id: string
          transfer_date?: string
          transfer_number: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          from_bank_account_id?: string
          gl_journal_entry_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["fund_transfer_status"]
          to_bank_account_id?: string
          transfer_date?: string
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_transfers_from_bank_account_id_fkey"
            columns: ["from_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_gl_journal_entry_id_fkey"
            columns: ["gl_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transfers_to_bank_account_id_fkey"
            columns: ["to_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_account_balances: {
        Row: {
          account_id: string
          balance: number
          credit_total: number
          debit_total: number
          fiscal_period_id: string
          id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          balance?: number
          credit_total?: number
          debit_total?: number
          fiscal_period_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          balance?: number
          credit_total?: number
          debit_total?: number
          fiscal_period_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_balances_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "gl_fiscal_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["gl_account_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_header: boolean
          normal_balance: string
          organization_id: string | null
          parent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["gl_account_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_header?: boolean
          normal_balance?: string
          organization_id?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["gl_account_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_header?: boolean
          normal_balance?: string
          organization_id?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_fiscal_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          fiscal_year: number
          id: string
          organization_id: string | null
          period_name: string
          period_number: number
          start_date: string
          status: Database["public"]["Enums"]["fiscal_period_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          fiscal_year: number
          id?: string
          organization_id?: string | null
          period_name: string
          period_number: number
          start_date: string
          status?: Database["public"]["Enums"]["fiscal_period_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          fiscal_year?: number
          id?: string
          organization_id?: string | null
          period_name?: string
          period_number?: number
          start_date?: string
          status?: Database["public"]["Enums"]["fiscal_period_status"]
        }
        Relationships: [
          {
            foreignKeyName: "gl_fiscal_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          entry_date: string
          entry_number: string
          exchange_rate: number
          fiscal_period_id: string | null
          id: string
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          reversed_entry_id: string | null
          source_id: string | null
          source_module: string | null
          status: Database["public"]["Enums"]["gl_entry_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          entry_number: string
          exchange_rate?: number
          fiscal_period_id?: string | null
          id?: string
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: Database["public"]["Enums"]["gl_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          entry_number?: string
          exchange_rate?: number
          fiscal_period_id?: string | null
          id?: string
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: Database["public"]["Enums"]["gl_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_journal_entries_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "gl_fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_journal_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "gl_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "goods_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "inventory_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          quantity: number
        }
        Insert: {
          id?: string
          item_id: string
          last_updated?: string
          location_id: string
          organization_id?: string | null
          quantity?: number
        }
        Update: {
          id?: string
          item_id?: string
          last_updated?: string
          location_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_costing_consumptions: {
        Row: {
          consumed_at: string
          consumption_source_id: string | null
          consumption_type: string
          id: string
          layer_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          consumed_at?: string
          consumption_source_id?: string | null
          consumption_type?: string
          id?: string
          layer_id: string
          quantity: number
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          consumed_at?: string
          consumption_source_id?: string | null
          consumption_type?: string
          id?: string
          layer_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_costing_consumptions_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "inventory_costing_layers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_costing_layers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          location_id: string
          organization_id: string | null
          original_qty: number
          receipt_date: string
          remaining_qty: number
          source_id: string | null
          source_type: string
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          location_id: string
          organization_id?: string | null
          original_qty: number
          receipt_date?: string
          remaining_qty: number
          source_id?: string | null
          source_type?: string
          total_cost?: number | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string
          organization_id?: string | null
          original_qty?: number
          receipt_date?: string
          remaining_qty?: number
          source_id?: string | null
          source_type?: string
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_costing_layers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_costing_layers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_costing_layers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issue_lines: {
        Row: {
          description: string | null
          id: string
          issue_id: string
          item_id: string
          quantity: number
          target_gl_account_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          issue_id: string
          item_id: string
          quantity: number
          target_gl_account_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          issue_id?: string
          item_id?: string
          quantity?: number
          target_gl_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issue_lines_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inventory_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issue_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issue_lines_target_gl_account_id_fkey"
            columns: ["target_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issues: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          issue_date: string
          issue_number: string
          issued_to: string | null
          location_id: string
          notes: string | null
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["issue_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          issue_date?: string
          issue_number: string
          issued_to?: string | null
          location_id: string
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          issue_date?: string
          issue_number?: string
          issued_to?: string | null
          location_id?: string
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "invoice_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "invoice_holds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tax_mappings: {
        Row: {
          created_at: string
          id: string
          item_category: string
          organization_id: string | null
          tax_group_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_category: string
          organization_id?: string | null
          tax_group_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_category?: string
          organization_id?: string | null
          tax_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tax_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tax_mappings_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "match_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          app_name: string | null
          base_currency: string
          city: string | null
          code: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          is_multicurrency: boolean
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          app_name?: string | null
          base_currency?: string
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_multicurrency?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          app_name?: string | null
          base_currency?: string
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_multicurrency?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
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
          organization_id: string | null
          po_id: string
          rejected_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          po_id: string
          rejected_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          po_id?: string
          rejected_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          is_active: boolean
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_costs: {
        Row: {
          amount: number
          cost_date: string
          cost_type: Database["public"]["Enums"]["project_cost_type"]
          created_at: string
          created_by: string | null
          description: string
          gl_journal_entry_id: string | null
          id: string
          organization_id: string | null
          posted: boolean
          posted_at: string | null
          posted_by: string | null
          project_id: string
          source_id: string | null
          source_module: string | null
        }
        Insert: {
          amount: number
          cost_date?: string
          cost_type: Database["public"]["Enums"]["project_cost_type"]
          created_at?: string
          created_by?: string | null
          description: string
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          project_id: string
          source_id?: string | null
          source_module?: string | null
        }
        Update: {
          amount?: number
          cost_date?: string
          cost_type?: Database["public"]["Enums"]["project_cost_type"]
          created_at?: string
          created_by?: string | null
          description?: string
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          project_id?: string
          source_id?: string | null
          source_module?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_gl_journal_entry_id_fkey"
            columns: ["gl_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_revenues: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          gl_journal_entry_id: string | null
          id: string
          organization_id: string | null
          posted: boolean
          posted_at: string | null
          posted_by: string | null
          project_id: string
          revenue_date: string
          source_id: string | null
          source_module: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          project_id: string
          revenue_date?: string
          source_id?: string | null
          source_module?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          gl_journal_entry_id?: string | null
          id?: string
          organization_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          project_id?: string
          revenue_date?: string
          source_id?: string | null
          source_module?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_revenues_gl_journal_entry_id_fkey"
            columns: ["gl_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_revenues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_revenues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budgeted_amount: number
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          organization_id: string | null
          profit_margin: number | null
          project_code: string
          project_name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          total_costs: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          budgeted_amount?: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string | null
          profit_margin?: number | null
          project_code: string
          project_name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_costs?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string | null
          profit_margin?: number | null
          project_code?: string
          project_name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          total_costs?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          currency: string
          discount_amount: number
          discount_type: string
          exchange_rate: number
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          organization_id: string | null
          po_number: string
          rejection_reason: string | null
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
          currency?: string
          discount_amount?: number
          discount_type?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          organization_id?: string | null
          po_number: string
          rejection_reason?: string | null
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
          currency?: string
          discount_amount?: number
          discount_type?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          organization_id?: string | null
          po_number?: string
          rejection_reason?: string | null
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
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "reorder_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_bid_entries: {
        Row: {
          bid_request_id: string
          created_at: string
          id: string
          is_recommended: boolean
          notes: string | null
          quantity: number
          requisition_line_id: string
          unit_price: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          bid_request_id: string
          created_at?: string
          id?: string
          is_recommended?: boolean
          notes?: string | null
          quantity?: number
          requisition_line_id: string
          unit_price?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          bid_request_id?: string
          created_at?: string
          id?: string
          is_recommended?: boolean
          notes?: string | null
          quantity?: number
          requisition_line_id?: string
          unit_price?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisition_bid_entries_bid_request_id_fkey"
            columns: ["bid_request_id"]
            isOneToOne: false
            referencedRelation: "requisition_bid_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_bid_entries_requisition_line_id_fkey"
            columns: ["requisition_line_id"]
            isOneToOne: false
            referencedRelation: "requisition_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_bid_entries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_bid_requests: {
        Row: {
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          notes: string | null
          organization_id: string | null
          requisition_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          requisition_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          requisition_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisition_bid_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_bid_requests_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
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
          item_id: string | null
          line_number: number
          qty_converted: number
          quantity: number
          requisition_id: string
          service_id: string | null
          specifications: string | null
        }
        Insert: {
          created_at?: string
          estimated_total?: number | null
          estimated_unit_cost?: number | null
          id?: string
          item_id?: string | null
          line_number: number
          qty_converted?: number
          quantity: number
          requisition_id: string
          service_id?: string | null
          specifications?: string | null
        }
        Update: {
          created_at?: string
          estimated_total?: number | null
          estimated_unit_cost?: number | null
          id?: string
          item_id?: string | null
          line_number?: number
          qty_converted?: number
          quantity?: number
          requisition_id?: string
          service_id?: string | null
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
          {
            foreignKeyName: "requisition_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          organization_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          req_number: string
          requester_id: string
          requisition_type: string
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
          organization_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          req_number: string
          requester_id: string
          requisition_type?: string
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
          organization_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          req_number?: string
          requester_id?: string
          requisition_type?: string
          status?: Database["public"]["Enums"]["requisition_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_recognition_entries: {
        Row: {
          amount: number
          created_at: string
          fiscal_period_id: string | null
          id: string
          journal_entry_id: string | null
          organization_id: string | null
          posted: boolean
          recognized_date: string
          schedule_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fiscal_period_id?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id?: string | null
          posted?: boolean
          recognized_date: string
          schedule_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fiscal_period_id?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id?: string | null
          posted?: boolean
          recognized_date?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_recognition_entries_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "gl_fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "gl_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "revenue_recognition_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_recognition_schedules: {
        Row: {
          ar_invoice_line_id: string
          created_at: string
          end_date: string
          id: string
          organization_id: string | null
          recognized_amount: number
          schedule_type: string
          start_date: string
          status: Database["public"]["Enums"]["revenue_schedule_status"]
          total_amount: number
        }
        Insert: {
          ar_invoice_line_id: string
          created_at?: string
          end_date: string
          id?: string
          organization_id?: string | null
          recognized_amount?: number
          schedule_type?: string
          start_date: string
          status?: Database["public"]["Enums"]["revenue_schedule_status"]
          total_amount: number
        }
        Update: {
          ar_invoice_line_id?: string
          created_at?: string
          end_date?: string
          id?: string
          organization_id?: string | null
          recognized_amount?: number
          schedule_type?: string
          start_date?: string
          status?: Database["public"]["Enums"]["revenue_schedule_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_recognition_schedules_ar_invoice_line_id_fkey"
            columns: ["ar_invoice_line_id"]
            isOneToOne: false
            referencedRelation: "ar_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_criteria: {
        Row: {
          created_at: string
          criterion_name: string
          description: string | null
          id: string
          rfp_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          criterion_name: string
          description?: string | null
          id?: string
          rfp_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          criterion_name?: string
          description?: string | null
          id?: string
          rfp_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfp_criteria_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          rfp_id: string
          specifications: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          rfp_id: string
          specifications?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          rfp_id?: string
          specifications?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfp_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_items_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_proposal_lines: {
        Row: {
          created_at: string
          delivery_days: number | null
          id: string
          line_total: number | null
          proposal_id: string
          quantity: number
          rfp_item_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivery_days?: number | null
          id?: string
          line_total?: number | null
          proposal_id: string
          quantity: number
          rfp_item_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          delivery_days?: number | null
          id?: string
          line_total?: number | null
          proposal_id?: string
          quantity?: number
          rfp_item_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfp_proposal_lines_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "rfp_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_proposal_lines_rfp_item_id_fkey"
            columns: ["rfp_item_id"]
            isOneToOne: false
            referencedRelation: "rfp_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_proposals: {
        Row: {
          cover_letter: string | null
          created_at: string
          delivery_timeline_days: number | null
          id: string
          rfp_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
          total_amount: number | null
          updated_at: string
          vendor_id: string
          weighted_score: number | null
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          delivery_timeline_days?: number | null
          id?: string
          rfp_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          total_amount?: number | null
          updated_at?: string
          vendor_id: string
          weighted_score?: number | null
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          delivery_timeline_days?: number | null
          id?: string
          rfp_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfp_proposals_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_proposals_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_scores: {
        Row: {
          comments: string | null
          created_at: string
          criterion_id: string
          evaluated_by: string | null
          id: string
          proposal_id: string
          score: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          criterion_id: string
          evaluated_by?: string | null
          id?: string
          proposal_id: string
          score?: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          criterion_id?: string
          evaluated_by?: string | null
          id?: string
          proposal_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfp_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rfp_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_scores_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "rfp_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      rfps: {
        Row: {
          awarded_proposal_id: string | null
          awarded_vendor_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          organization_id: string | null
          rfp_number: string
          status: Database["public"]["Enums"]["rfp_status"]
          title: string
          updated_at: string
        }
        Insert: {
          awarded_proposal_id?: string | null
          awarded_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          rfp_number: string
          status?: Database["public"]["Enums"]["rfp_status"]
          title: string
          updated_at?: string
        }
        Update: {
          awarded_proposal_id?: string | null
          awarded_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          rfp_number?: string
          status?: Database["public"]["Enums"]["rfp_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfps_awarded_proposal_id_fkey"
            columns: ["awarded_proposal_id"]
            isOneToOne: false
            referencedRelation: "rfp_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_awarded_vendor_id_fkey"
            columns: ["awarded_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          description: string
          id: string
          item_id: string | null
          line_number: number
          line_total: number | null
          order_id: string
          qty_delivered: number
          qty_invoiced: number
          quantity: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          line_number: number
          line_total?: number | null
          order_id: string
          qty_delivered?: number
          qty_invoiced?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          line_number?: number
          line_total?: number | null
          order_id?: string
          qty_delivered?: number
          qty_invoiced?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          exchange_rate: number
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          organization_id: string | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_group_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          organization_id?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_group_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          organization_id?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_group_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotation_lines: {
        Row: {
          description: string
          id: string
          item_id: string | null
          line_number: number
          line_total: number | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          line_number: number
          line_total?: number | null
          quantity?: number
          quotation_id: string
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          line_number?: number
          line_total?: number | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          exchange_rate: number
          id: string
          notes: string | null
          organization_id: string | null
          quotation_date: string
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_group_id: string | null
          total_amount: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          quotation_date?: string
          quotation_number: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_group_id?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          quotation_date?: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_group_id?: string | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          gl_account_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          rate_pct: number
          tax_group_id: string
        }
        Insert: {
          created_at?: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          rate_pct?: number
          tax_group_id: string
        }
        Update: {
          created_at?: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          rate_pct?: number
          tax_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          organization_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_counters: {
        Row: {
          document_type: string
          id: string
          last_number: number
          organization_id: string
          prefix: string
        }
        Insert: {
          document_type: string
          id?: string
          last_number?: number
          organization_id: string
          prefix: string
        }
        Update: {
          document_type?: string
          id?: string
          last_number?: number
          organization_id?: string
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
          rejected_at: string | null
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          rejected_at?: string | null
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          rejected_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          phone?: string | null
          title?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invite_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invite_tokens_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_ratings: {
        Row: {
          comments: string | null
          created_at: string
          delivery_rating: number | null
          id: string
          organization_id: string | null
          po_id: string | null
          quality_rating: number | null
          rating: number
          reviewed_by: string | null
          vendor_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          id?: string
          organization_id?: string | null
          po_id?: string | null
          quality_rating?: number | null
          rating: number
          reviewed_by?: string | null
          vendor_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          id?: string
          organization_id?: string | null
          po_id?: string | null
          quality_rating?: number | null
          rating?: number
          reviewed_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_ratings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_ratings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_registration_requests: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_name: string
          country: string | null
          created_at: string
          email: string
          id: string
          organization_id: string | null
          phone: string | null
          project_size_capacity: string | null
          rc_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_categories: string[] | null
          status: string
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_name: string
          country?: string | null
          created_at?: string
          email: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          project_size_capacity?: string | null
          rc_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_categories?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          project_size_capacity?: string | null
          rc_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_categories?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_registration_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_registration_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_users_vendor_id_fkey"
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
          organization_id: string | null
          payment_terms: number | null
          phone: string | null
          project_size_capacity: string | null
          rc_number: string | null
          rejection_reason: string | null
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
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          project_size_capacity?: string | null
          rc_number?: string | null
          rejection_reason?: string | null
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
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          project_size_capacity?: string | null
          rc_number?: string | null
          rejection_reason?: string | null
          service_categories?: string[] | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_auto_actions: {
        Row: {
          action_type: string
          config: Json | null
          created_at: string
          id: string
          transition_id: string
          trigger_type: string
        }
        Insert: {
          action_type: string
          config?: Json | null
          created_at?: string
          id?: string
          transition_id: string
          trigger_type?: string
        }
        Update: {
          action_type?: string
          config?: Json | null
          created_at?: string
          id?: string
          transition_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_auto_actions_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "workflow_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_initial: boolean | null
          is_terminal: boolean | null
          state_label: string
          state_name: string
          state_order: number
          workflow_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_initial?: boolean | null
          is_terminal?: boolean | null
          state_label: string
          state_name: string
          state_order?: number
          workflow_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_initial?: boolean | null
          is_terminal?: boolean | null
          state_label?: string
          state_name?: string
          state_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          action_label: string
          conditions: Json | null
          created_at: string
          from_state_id: string
          id: string
          required_role: string | null
          requires_approval: boolean | null
          to_state_id: string
          workflow_id: string
        }
        Insert: {
          action_label: string
          conditions?: Json | null
          created_at?: string
          from_state_id: string
          id?: string
          required_role?: string | null
          requires_approval?: boolean | null
          to_state_id: string
          workflow_id: string
        }
        Update: {
          action_label?: string
          conditions?: Json | null
          created_at?: string
          from_state_id?: string
          id?: string
          required_role?: string | null
          requires_approval?: boolean | null
          to_state_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_transactional_data: { Args: never; Returns: undefined }
      consume_fifo_layers: {
        Args: {
          p_consumption_type: string
          p_item_id: string
          p_location_id: string
          p_quantity: number
          p_source_id: string
        }
        Returns: number
      }
      get_user_org_id: { Args: never; Returns: string }
      get_user_programs: { Args: { p_user_id: string }; Returns: string[] }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      gl_account_has_transactions: {
        Args: { p_account_id: string }
        Returns: boolean
      }
      gl_carry_forward_balances: {
        Args: { p_from_year: number; p_to_year: number }
        Returns: string
      }
      gl_period_end_summary: { Args: { p_period_id: string }; Returns: string }
      gl_year_end_close: { Args: { p_fiscal_year: number }; Returns: string }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_transaction_number: {
        Args: { p_doc_type: string; p_org_id: string; p_prefix?: string }
        Returns: string
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
        | "procurement_officer"
        | "warehouse_officer"
        | "ap_clerk"
        | "requisitioner"
        | "vendor_user"
        | "employee"
      approval_action_type: "approved" | "rejected" | "delegated" | "escalated"
      approval_instance_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
      approval_step_type: "sequential" | "parallel" | "any_of"
      ar_credit_note_status: "draft" | "posted" | "void"
      ar_invoice_status: "draft" | "posted" | "void"
      ar_payment_status: "unpaid" | "partial" | "paid"
      bank_txn_status: "unreconciled" | "reconciled" | "voided"
      bank_txn_type:
        | "deposit"
        | "withdrawal"
        | "transfer_in"
        | "transfer_out"
        | "fee"
        | "interest"
      budget_source_type: "po_commitment" | "invoice_actual"
      budget_status: "draft" | "active" | "closed" | "frozen"
      budget_transaction_type: "commit" | "uncommit" | "consume" | "reverse"
      delivery_status: "draft" | "posted"
      fiscal_period_status: "open" | "closed" | "locked"
      fund_transfer_status: "draft" | "posted"
      gl_account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      gl_entry_status: "draft" | "posted" | "reversed"
      hold_type:
        | "match_exception"
        | "approval_pending"
        | "budget_exceeded"
        | "manual"
      issue_status: "draft" | "posted"
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
      project_cost_type:
        | "labor"
        | "material"
        | "expense"
        | "subcontract"
        | "overhead"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      proposal_status:
        | "invited"
        | "submitted"
        | "awarded"
        | "rejected"
        | "declined"
      quotation_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      reconciliation_status: "in_progress" | "completed"
      requisition_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
        | "partially_converted"
        | "fully_converted"
      reservation_status: "active" | "fulfilled" | "cancelled" | "expired"
      revenue_schedule_status: "active" | "completed" | "cancelled"
      rfp_status: "draft" | "published" | "evaluating" | "awarded" | "cancelled"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "partially_delivered"
        | "fully_delivered"
        | "closed"
        | "cancelled"
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
        "procurement_officer",
        "warehouse_officer",
        "ap_clerk",
        "requisitioner",
        "vendor_user",
        "employee",
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
      ar_credit_note_status: ["draft", "posted", "void"],
      ar_invoice_status: ["draft", "posted", "void"],
      ar_payment_status: ["unpaid", "partial", "paid"],
      bank_txn_status: ["unreconciled", "reconciled", "voided"],
      bank_txn_type: [
        "deposit",
        "withdrawal",
        "transfer_in",
        "transfer_out",
        "fee",
        "interest",
      ],
      budget_source_type: ["po_commitment", "invoice_actual"],
      budget_status: ["draft", "active", "closed", "frozen"],
      budget_transaction_type: ["commit", "uncommit", "consume", "reverse"],
      delivery_status: ["draft", "posted"],
      fiscal_period_status: ["open", "closed", "locked"],
      fund_transfer_status: ["draft", "posted"],
      gl_account_type: ["asset", "liability", "equity", "revenue", "expense"],
      gl_entry_status: ["draft", "posted", "reversed"],
      hold_type: [
        "match_exception",
        "approval_pending",
        "budget_exceeded",
        "manual",
      ],
      issue_status: ["draft", "posted"],
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
      project_cost_type: [
        "labor",
        "material",
        "expense",
        "subcontract",
        "overhead",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      proposal_status: [
        "invited",
        "submitted",
        "awarded",
        "rejected",
        "declined",
      ],
      quotation_status: ["draft", "sent", "accepted", "rejected", "expired"],
      reconciliation_status: ["in_progress", "completed"],
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
      revenue_schedule_status: ["active", "completed", "cancelled"],
      rfp_status: ["draft", "published", "evaluating", "awarded", "cancelled"],
      sales_order_status: [
        "draft",
        "confirmed",
        "partially_delivered",
        "fully_delivered",
        "closed",
        "cancelled",
      ],
      vendor_status: ["draft", "pending_approval", "active", "inactive"],
    },
  },
} as const
