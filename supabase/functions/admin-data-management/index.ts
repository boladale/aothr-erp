import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Admin access required");

    const { action } = await req.json();

    if (action === "cleanup") {
      // Delete transactional data in FK-safe order
      const deleteStatements = [
        // Attachments & notifications
        "DELETE FROM transaction_attachments",
        "DELETE FROM notifications",
        // Audit logs
        "DELETE FROM audit_logs",
        // Approval workflow
        "DELETE FROM approval_actions",
        "DELETE FROM approval_instances",
        // Invoice holds & matching
        "DELETE FROM invoice_holds",
        "DELETE FROM match_lines",
        "DELETE FROM match_runs",
        // Invoice approvals
        "DELETE FROM invoice_approvals",
        // AP payment allocations -> payments
        "DELETE FROM ap_payment_allocations",
        "DELETE FROM ap_payments",
        // AP invoice lines -> invoices
        "DELETE FROM ap_invoice_lines",
        "DELETE FROM ap_invoices",
        // Vendor ratings (references POs)
        "DELETE FROM vendor_ratings",
        // Inventory costing
        "DELETE FROM inventory_costing_consumptions",
        "DELETE FROM inventory_costing_layers",
        // GRN lines -> GRNs
        "DELETE FROM goods_receipt_lines",
        "DELETE FROM goods_receipts",
        // PO line requisition links
        "DELETE FROM po_line_requisition_lines",
        // PO lines -> POs
        "DELETE FROM purchase_order_lines",
        "DELETE FROM purchase_orders",
        // Requisition lines -> requisitions
        "DELETE FROM requisition_lines",
        "DELETE FROM requisitions",
        // RFP chain
        "DELETE FROM rfp_scores",
        "DELETE FROM rfp_proposal_lines",
        "DELETE FROM rfp_proposals",
        "DELETE FROM rfp_items",
        "DELETE FROM rfps",
        // AR chain
        "DELETE FROM ar_receipt_allocations",
        "DELETE FROM ar_receipts",
        "DELETE FROM ar_credit_note_lines",
        "DELETE FROM ar_credit_notes",
        "DELETE FROM ar_invoice_lines",
        "DELETE FROM ar_invoices",
        // Sales chain
        "DELETE FROM delivery_note_lines",
        "DELETE FROM delivery_notes",
        "DELETE FROM sales_order_lines",
        "DELETE FROM sales_orders",
        "DELETE FROM sales_quotation_lines",
        "DELETE FROM sales_quotations",
        // GL
        "DELETE FROM gl_journal_lines",
        "DELETE FROM gl_journal_entries",
        "DELETE FROM gl_account_balances",
        // Bank
        "DELETE FROM bank_transactions",
        "DELETE FROM bank_reconciliations",
        "DELETE FROM fund_transfers",
        // Inventory
        "DELETE FROM inventory_adjustment_lines",
        "DELETE FROM inventory_adjustments",
        "DELETE FROM inventory_reservations",
        "DELETE FROM inventory_balances",
        // Budget consumption (keep budgets/budget_lines)
        "DELETE FROM budget_consumption",
        // Projects
        "DELETE FROM revenue_recognition_entries",
        "DELETE FROM revenue_recognition_schedules",
        "DELETE FROM project_costs",
        "DELETE FROM project_revenues",
        "DELETE FROM projects",
        // Vendor docs/contacts/approvals (transactional, not master)
        "DELETE FROM vendor_approvals",
        "DELETE FROM vendor_contacts",
        "DELETE FROM vendor_documents",
        // Reset bank balances to opening
        "UPDATE bank_accounts SET current_balance = opening_balance",
      ];

      for (const sql of deleteStatements) {
        const { error } = await supabase.rpc("exec_sql", { sql_text: sql }).maybeSingle();
        if (error) {
          // Try direct approach if rpc doesn't exist
          const tableName = sql.match(/(?:DELETE FROM|UPDATE)\s+(\w+)/)?.[1];
          if (tableName && sql.startsWith("DELETE")) {
            const { error: delError } = await supabase.from(tableName).delete().neq("id", "00000000-0000-0000-0000-000000000000");
            if (delError && !delError.message.includes("column")) {
              console.error(`Error on ${tableName}:`, delError.message);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Transactional data cleaned up" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "seed") {
      // Get existing master data IDs
      const { data: vendors } = await supabase.from("vendors").select("id, code").limit(5);
      const { data: items } = await supabase.from("items").select("id, code, unit_cost").limit(10);
      const { data: locations } = await supabase.from("locations").select("id, code").limit(3);
      const { data: customers } = await supabase.from("customers").select("id, code").limit(5);

      if (!vendors?.length || !items?.length || !locations?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Please create master data first (vendors, items, locations) before seeding demo data" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString().split("T")[0];
      const inThirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];

      // ============ REQUISITIONS ============
      const reqData = [
        { req_number: "REQ-DEMO-001", department: "Engineering", justification: "Office supplies needed", status: "draft", requester_id: user.id, created_by: user.id, needed_by_date: inThirtyDays },
        { req_number: "REQ-DEMO-002", department: "Marketing", justification: "Trade show materials", status: "submitted", requester_id: user.id, created_by: user.id, needed_by_date: inThirtyDays, submitted_at: now.toISOString() },
        { req_number: "REQ-DEMO-003", department: "Operations", justification: "Safety equipment replenishment", status: "approved", requester_id: user.id, created_by: user.id, needed_by_date: inThirtyDays, submitted_at: thirtyDaysAgo, approved_at: thirtyDaysAgo, approved_by: user.id },
      ];
      const { data: reqs } = await supabase.from("requisitions").insert(reqData).select("id");

      if (reqs && items.length >= 2) {
        const reqLines = [];
        for (let i = 0; i < reqs.length; i++) {
          reqLines.push(
            { requisition_id: reqs[i].id, item_id: items[0].id, line_number: 1, quantity: 10, estimated_unit_cost: items[0].unit_cost || 25 },
            { requisition_id: reqs[i].id, item_id: items[1].id, line_number: 2, quantity: 5, estimated_unit_cost: items[1].unit_cost || 50 },
          );
        }
        await supabase.from("requisition_lines").insert(reqLines);
      }

      // ============ PURCHASE ORDERS ============
      const poData = [
        { po_number: "PO-DEMO-001", vendor_id: vendors[0].id, status: "draft", order_date: today, expected_date: inThirtyDays, created_by: user.id, ship_to_location_id: locations[0].id, subtotal: 500, total_amount: 500 },
        { po_number: "PO-DEMO-002", vendor_id: vendors[Math.min(1, vendors.length - 1)].id, status: "sent", order_date: thirtyDaysAgo, expected_date: today, created_by: user.id, sent_at: thirtyDaysAgo, approved_by: user.id, approved_at: thirtyDaysAgo, ship_to_location_id: locations[0].id, subtotal: 1200, total_amount: 1200 },
        { po_number: "PO-DEMO-003", vendor_id: vendors[0].id, status: "partially_received", order_date: sixtyDaysAgo, expected_date: thirtyDaysAgo, created_by: user.id, sent_at: sixtyDaysAgo, approved_by: user.id, approved_at: sixtyDaysAgo, ship_to_location_id: locations[0].id, subtotal: 2000, total_amount: 2000 },
      ];
      const { data: pos } = await supabase.from("purchase_orders").insert(poData).select("id");

      if (pos && items.length >= 2) {
        const poLines = [];
        for (let i = 0; i < pos.length; i++) {
          poLines.push(
            { po_id: pos[i].id, item_id: items[0].id, line_number: 1, quantity: 20, unit_price: items[0].unit_cost || 25, line_total: 20 * (items[0].unit_cost || 25) },
            { po_id: pos[i].id, item_id: items[1].id, line_number: 2, quantity: 10, unit_price: items[1].unit_cost || 50, line_total: 10 * (items[1].unit_cost || 50) },
          );
        }
        const { data: polData } = await supabase.from("purchase_order_lines").insert(poLines).select("id, po_id, item_id, quantity, unit_price");

        // ============ GOODS RECEIPTS (for PO-DEMO-003) ============
        if (polData) {
          const po3Lines = polData.filter(l => l.po_id === pos[2].id);
          if (po3Lines.length > 0) {
            const { data: grns } = await supabase.from("goods_receipts").insert({
              grn_number: "GRN-DEMO-001",
              po_id: pos[2].id,
              location_id: locations[0].id,
              receipt_date: thirtyDaysAgo,
              status: "draft",
              created_by: user.id,
            }).select("id");

            if (grns) {
              await supabase.from("goods_receipt_lines").insert(
                po3Lines.map(l => ({
                  grn_id: grns[0].id,
                  po_line_id: l.id,
                  item_id: l.item_id,
                  qty_received: Math.floor(l.quantity / 2),
                }))
              );
            }
          }

          // ============ AP INVOICES (for PO-DEMO-002) ============
          const po2Lines = polData.filter(l => l.po_id === pos[1].id);
          if (po2Lines.length > 0) {
            const invTotal = po2Lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
            const { data: invoices } = await supabase.from("ap_invoices").insert({
              invoice_number: "INV-DEMO-001",
              po_id: pos[1].id,
              vendor_id: vendors[Math.min(1, vendors.length - 1)].id,
              invoice_date: thirtyDaysAgo,
              due_date: inThirtyDays,
              status: "draft",
              payment_status: "unpaid",
              subtotal: invTotal,
              total_amount: invTotal,
              created_by: user.id,
            }).select("id");

            if (invoices) {
              await supabase.from("ap_invoice_lines").insert(
                po2Lines.map(l => ({
                  invoice_id: invoices[0].id,
                  po_line_id: l.id,
                  item_id: l.item_id,
                  quantity: l.quantity,
                  unit_price: l.unit_price,
                  line_total: l.quantity * l.unit_price,
                }))
              );
            }
          }
        }
      }

      // ============ RFPs ============
      if (items.length >= 1) {
        const { data: rfpData } = await supabase.from("rfps").insert([
          { rfp_number: "RFP-DEMO-001", title: "IT Equipment Procurement", description: "Annual IT hardware refresh", status: "draft", created_by: user.id, deadline: new Date(now.getTime() + 14 * 86400000).toISOString() },
          { rfp_number: "RFP-DEMO-002", title: "Office Furniture Tender", description: "New office furniture for expansion", status: "published", created_by: user.id, deadline: new Date(now.getTime() + 30 * 86400000).toISOString() },
        ]).select("id");

        if (rfpData) {
          await supabase.from("rfp_items").insert([
            { rfp_id: rfpData[0].id, item_id: items[0].id, quantity: 50, specifications: "Must meet ISO standards" },
            { rfp_id: rfpData[1].id, item_id: items[Math.min(1, items.length - 1)].id, quantity: 100, specifications: "Ergonomic design required" },
          ]);

          // Add proposals for published RFP
          if (vendors.length >= 2) {
            const { data: proposals } = await supabase.from("rfp_proposals").insert([
              { rfp_id: rfpData[1].id, vendor_id: vendors[0].id, status: "submitted", total_amount: 15000, delivery_timeline_days: 14, cover_letter: "We are pleased to submit our proposal.", submitted_at: now.toISOString() },
              { rfp_id: rfpData[1].id, vendor_id: vendors[1].id, status: "submitted", total_amount: 13500, delivery_timeline_days: 21, cover_letter: "Thank you for the opportunity to bid.", submitted_at: now.toISOString() },
            ]).select("id");
          }
        }
      }

      // ============ SALES QUOTATIONS & ORDERS ============
      if (customers?.length && items.length >= 1) {
        const { data: quotations } = await supabase.from("sales_quotations").insert([
          { quotation_number: "SQ-DEMO-001", customer_id: customers[0].id, status: "draft", subtotal: 5000, total_amount: 5000, valid_until: inThirtyDays, created_by: user.id },
        ]).select("id");

        if (quotations) {
          await supabase.from("sales_quotation_lines").insert([
            { quotation_id: quotations[0].id, item_id: items[0].id, line_number: 1, quantity: 100, unit_price: 50, description: items[0].code + " - bulk order", line_total: 5000 },
          ]);
        }

        const { data: orders } = await supabase.from("sales_orders").insert([
          { order_number: "SO-DEMO-001", customer_id: customers[0].id, status: "confirmed", order_date: thirtyDaysAgo, subtotal: 3000, total_amount: 3000, created_by: user.id },
        ]).select("id");

        if (orders) {
          await supabase.from("sales_order_lines").insert([
            { order_id: orders[0].id, item_id: items[0].id, line_number: 1, quantity: 60, unit_price: 50, description: items[0].code, line_total: 3000 },
          ]);
        }

        // ============ AR INVOICES ============
        const { data: arInvoices } = await supabase.from("ar_invoices").insert([
          { invoice_number: "AR-INV-DEMO-001", customer_id: customers[0].id, invoice_date: thirtyDaysAgo, due_date: inThirtyDays, status: "draft", payment_status: "unpaid", subtotal: 3000, total_amount: 3000, created_by: user.id },
        ]).select("id");

        if (arInvoices) {
          await supabase.from("ar_invoice_lines").insert([
            { invoice_id: arInvoices[0].id, item_id: items[0].id, quantity: 60, unit_price: 50, description: "Product delivery", line_total: 3000 },
          ]);
        }
      }

      // ============ PROJECTS ============
      await supabase.from("projects").insert([
        { project_code: "PRJ-DEMO-001", project_name: "Office Renovation", description: "HQ office renovation project", status: "active", budgeted_amount: 50000, start_date: thirtyDaysAgo, end_date: inThirtyDays, client_name: customers?.[0] ? "Internal" : "Internal", created_by: user.id },
        { project_code: "PRJ-DEMO-002", project_name: "IT Infrastructure Upgrade", description: "Network and server upgrades", status: "planning", budgeted_amount: 75000, start_date: today, created_by: user.id },
      ]);

      // ============ INVENTORY BALANCES ============
      if (items.length >= 2 && locations.length >= 1) {
        const balances = items.slice(0, Math.min(5, items.length)).map(item => ({
          item_id: item.id,
          location_id: locations[0].id,
          quantity: Math.floor(Math.random() * 200) + 50,
        }));
        
        // Use upsert to avoid conflicts
        for (const bal of balances) {
          await supabase.from("inventory_balances").upsert(bal, { onConflict: "item_id,location_id" });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Demo data seeded successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'seed' or 'cleanup'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
