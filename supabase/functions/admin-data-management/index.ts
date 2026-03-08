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
      const { error } = await supabase.rpc("cleanup_transactional_data");
      if (error) throw new Error("Cleanup failed: " + error.message);

      return new Response(JSON.stringify({ success: true, message: "All transactional data cleaned up. Setup data preserved." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "seed") {
      // Get existing master data IDs
      const [vendorsRes, itemsRes, locationsRes, customersRes] = await Promise.all([
        supabase.from("vendors").select("id, code").eq("status", "active").limit(5),
        supabase.from("items").select("id, code, unit_cost").eq("is_active", true).limit(10),
        supabase.from("locations").select("id, code").eq("is_active", true).limit(3),
        supabase.from("customers").select("id, code").limit(5),
      ]);

      const vendors = vendorsRes.data || [];
      const items = itemsRes.data || [];
      const locations = locationsRes.data || [];
      const customers = customersRes.data || [];

      if (!vendors.length || !items.length || !locations.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Please create master data first (active vendors, items, locations) before seeding demo data" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().split("T")[0];
      const daysFrom = (d: number) => new Date(now.getTime() + d * 86400000).toISOString().split("T")[0];

      const v = (i: number) => vendors[Math.min(i, vendors.length - 1)];
      const it = (i: number) => items[Math.min(i, items.length - 1)];
      const loc = (i: number) => locations[Math.min(i, locations.length - 1)];
      const cust = (i: number) => customers.length ? customers[Math.min(i, customers.length - 1)] : null;
      const cost = (item: any) => item.unit_cost || 25;

      // ============ REQUISITIONS ============
      const { data: reqs } = await supabase.from("requisitions").insert([
        { req_number: "REQ-DEMO-001", department: "Engineering", justification: "Office supplies needed for Q2", status: "draft", requester_id: user.id, created_by: user.id, needed_by_date: daysFrom(30) },
        { req_number: "REQ-DEMO-002", department: "Marketing", justification: "Trade show booth materials", status: "submitted", requester_id: user.id, created_by: user.id, needed_by_date: daysFrom(21), submitted_at: new Date().toISOString() },
        { req_number: "REQ-DEMO-003", department: "Operations", justification: "Safety equipment replenishment", status: "approved", requester_id: user.id, created_by: user.id, needed_by_date: daysFrom(14), submitted_at: daysAgo(10), approved_at: daysAgo(7), approved_by: user.id },
        { req_number: "REQ-DEMO-004", department: "IT", justification: "Server room cooling upgrade", status: "draft", requester_id: user.id, created_by: user.id, needed_by_date: daysFrom(45) },
      ]).select("id");

      if (reqs && items.length >= 2) {
        const reqLines = reqs.flatMap((r, i) => [
          { requisition_id: r.id, item_id: it(0).id, line_number: 1, quantity: 10 + i * 5, estimated_unit_cost: cost(it(0)) },
          { requisition_id: r.id, item_id: it(1).id, line_number: 2, quantity: 5 + i * 3, estimated_unit_cost: cost(it(1)) },
        ]);
        await supabase.from("requisition_lines").insert(reqLines);
      }

      // ============ PURCHASE ORDERS ============
      const { data: pos } = await supabase.from("purchase_orders").insert([
        { po_number: "PO-DEMO-001", vendor_id: v(0).id, status: "draft", order_date: today, expected_date: daysFrom(30), created_by: user.id, ship_to_location_id: loc(0).id, subtotal: 500, total_amount: 500 },
        { po_number: "PO-DEMO-002", vendor_id: v(1).id, status: "sent", order_date: daysAgo(20), expected_date: daysFrom(10), created_by: user.id, sent_at: daysAgo(18), approved_by: user.id, approved_at: daysAgo(19), ship_to_location_id: loc(0).id, subtotal: 1200, total_amount: 1200 },
        { po_number: "PO-DEMO-003", vendor_id: v(0).id, status: "partially_received", order_date: daysAgo(45), expected_date: daysAgo(15), created_by: user.id, sent_at: daysAgo(43), approved_by: user.id, approved_at: daysAgo(44), ship_to_location_id: loc(0).id, subtotal: 2000, total_amount: 2000 },
        { po_number: "PO-DEMO-004", vendor_id: v(1).id, status: "draft", order_date: today, expected_date: daysFrom(45), created_by: user.id, ship_to_location_id: loc(0).id, subtotal: 800, total_amount: 800, notes: "Urgent procurement for new project" },
      ]).select("id");

      let polData: any[] = [];
      if (pos && items.length >= 2) {
        const poLines = pos.flatMap((po, i) => [
          { po_id: po.id, item_id: it(0).id, line_number: 1, quantity: 20 + i * 5, unit_price: cost(it(0)), line_total: (20 + i * 5) * cost(it(0)) },
          { po_id: po.id, item_id: it(1).id, line_number: 2, quantity: 10 + i * 3, unit_price: cost(it(1)), line_total: (10 + i * 3) * cost(it(1)) },
        ]);
        const { data } = await supabase.from("purchase_order_lines").insert(poLines).select("id, po_id, item_id, quantity, unit_price");
        polData = data || [];
      }

      // ============ GOODS RECEIPTS (for PO-DEMO-003) ============
      if (pos && polData.length) {
        const po3Lines = polData.filter(l => l.po_id === pos[2].id);
        if (po3Lines.length) {
          const { data: grns } = await supabase.from("goods_receipts").insert({
            grn_number: "GRN-DEMO-001", po_id: pos[2].id, location_id: loc(0).id, receipt_date: daysAgo(10), status: "draft", created_by: user.id,
          }).select("id");

          if (grns) {
            await supabase.from("goods_receipt_lines").insert(
              po3Lines.map(l => ({ grn_id: grns[0].id, po_line_id: l.id, item_id: l.item_id, qty_received: Math.floor(l.quantity / 2) }))
            );
          }
        }

        // ============ AP INVOICES ============
        const po2Lines = polData.filter(l => l.po_id === pos[1].id);
        if (po2Lines.length) {
          const invTotal = po2Lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0);
          const { data: invoices } = await supabase.from("ap_invoices").insert({
            invoice_number: "INV-DEMO-001", po_id: pos[1].id, vendor_id: v(1).id,
            invoice_date: daysAgo(15), due_date: daysFrom(15), status: "draft", payment_status: "unpaid",
            subtotal: invTotal, total_amount: invTotal, created_by: user.id,
          }).select("id");

          if (invoices) {
            await supabase.from("ap_invoice_lines").insert(
              po2Lines.map(l => ({ invoice_id: invoices[0].id, po_line_id: l.id, item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price }))
            );
          }
        }
      }

      // ============ RFPs ============
      const { data: rfpData } = await supabase.from("rfps").insert([
        { rfp_number: "RFP-DEMO-001", title: "Annual IT Equipment Procurement", description: "Hardware refresh for FY2026", status: "draft", created_by: user.id, deadline: new Date(now.getTime() + 14 * 86400000).toISOString() },
        { rfp_number: "RFP-DEMO-002", title: "Office Furniture Tender", description: "Ergonomic furniture for new wing", status: "published", created_by: user.id, deadline: new Date(now.getTime() + 30 * 86400000).toISOString() },
        { rfp_number: "RFP-DEMO-003", title: "Security Systems Upgrade", description: "CCTV and access control upgrade", status: "draft", created_by: user.id, deadline: new Date(now.getTime() + 45 * 86400000).toISOString() },
      ]).select("id");

      if (rfpData && items.length >= 2) {
        await supabase.from("rfp_items").insert([
          { rfp_id: rfpData[0].id, item_id: it(0).id, quantity: 50, specifications: "Must meet ISO 27001 standards" },
          { rfp_id: rfpData[1].id, item_id: it(1).id, quantity: 100, specifications: "Ergonomic, BIFMA certified" },
          { rfp_id: rfpData[2].id, item_id: it(0).id, quantity: 25, specifications: "IP67 rated, night vision capable" },
        ]);

        if (vendors.length >= 2) {
          await supabase.from("rfp_proposals").insert([
            { rfp_id: rfpData[1].id, vendor_id: v(0).id, status: "submitted", total_amount: 15000, delivery_timeline_days: 14, cover_letter: "We are pleased to submit our competitive proposal for the furniture tender.", submitted_at: now.toISOString() },
            { rfp_id: rfpData[1].id, vendor_id: v(1).id, status: "submitted", total_amount: 13500, delivery_timeline_days: 21, cover_letter: "Thank you for the opportunity. Our proposal includes a 2-year warranty.", submitted_at: now.toISOString() },
          ]);
        }
      }

      // ============ SALES QUOTATIONS, ORDERS, AR ============
      if (cust(0)) {
        const { data: quotations } = await supabase.from("sales_quotations").insert([
          { quotation_number: "SQ-DEMO-001", customer_id: cust(0)!.id, status: "draft", subtotal: 5000, total_amount: 5000, valid_until: daysFrom(30), created_by: user.id },
          { quotation_number: "SQ-DEMO-002", customer_id: cust(0)!.id, status: "sent", subtotal: 8500, total_amount: 8500, valid_until: daysFrom(14), created_by: user.id },
        ]).select("id");

        if (quotations) {
          await supabase.from("sales_quotation_lines").insert([
            { quotation_id: quotations[0].id, item_id: it(0).id, line_number: 1, quantity: 100, unit_price: 50, description: it(0).code + " - bulk order", line_total: 5000 },
            { quotation_id: quotations[1].id, item_id: it(1).id, line_number: 1, quantity: 85, unit_price: 100, description: it(1).code + " - premium", line_total: 8500 },
          ]);
        }

        const { data: orders } = await supabase.from("sales_orders").insert([
          { order_number: "SO-DEMO-001", customer_id: cust(0)!.id, status: "confirmed", order_date: daysAgo(20), subtotal: 3000, total_amount: 3000, created_by: user.id },
          { order_number: "SO-DEMO-002", customer_id: cust(0)!.id, status: "draft", order_date: today, subtotal: 1500, total_amount: 1500, created_by: user.id },
        ]).select("id");

        if (orders) {
          await supabase.from("sales_order_lines").insert([
            { order_id: orders[0].id, item_id: it(0).id, line_number: 1, quantity: 60, unit_price: 50, description: it(0).code, line_total: 3000 },
            { order_id: orders[1].id, item_id: it(1).id, line_number: 1, quantity: 15, unit_price: 100, description: it(1).code, line_total: 1500 },
          ]);
        }

        const { data: arInvoices } = await supabase.from("ar_invoices").insert([
          { invoice_number: "AR-INV-DEMO-001", customer_id: cust(0)!.id, invoice_date: daysAgo(25), due_date: daysFrom(5), status: "draft", payment_status: "unpaid", subtotal: 3000, total_amount: 3000, created_by: user.id },
          { invoice_number: "AR-INV-DEMO-002", customer_id: cust(0)!.id, invoice_date: daysAgo(10), due_date: daysFrom(20), status: "draft", payment_status: "unpaid", subtotal: 1500, total_amount: 1500, created_by: user.id },
        ]).select("id");

        if (arInvoices) {
          await supabase.from("ar_invoice_lines").insert([
            { invoice_id: arInvoices[0].id, item_id: it(0).id, quantity: 60, unit_price: 50, description: "Product delivery - SO-DEMO-001", line_total: 3000 },
            { invoice_id: arInvoices[1].id, item_id: it(1).id, quantity: 15, unit_price: 100, description: "Product delivery - SO-DEMO-002", line_total: 1500 },
          ]);
        }
      }

      // ============ PROJECTS ============
      await supabase.from("projects").insert([
        { project_code: "PRJ-DEMO-001", project_name: "Office Renovation Phase 1", description: "Main HQ office renovation", status: "active", budgeted_amount: 50000, start_date: daysAgo(30), end_date: daysFrom(60), client_name: "Internal", created_by: user.id },
        { project_code: "PRJ-DEMO-002", project_name: "IT Infrastructure Upgrade", description: "Network and server modernization", status: "planning", budgeted_amount: 75000, start_date: today, created_by: user.id },
        { project_code: "PRJ-DEMO-003", project_name: "Warehouse Expansion", description: "New storage facility build-out", status: "planning", budgeted_amount: 120000, start_date: daysFrom(30), client_name: "Internal", created_by: user.id },
      ]);

      // ============ INVENTORY BALANCES ============
      const balanceItems = items.slice(0, Math.min(5, items.length));
      for (const item of balanceItems) {
        await supabase.from("inventory_balances").upsert({
          item_id: item.id, location_id: loc(0).id, quantity: Math.floor(Math.random() * 200) + 50,
        }, { onConflict: "item_id,location_id" });
      }

      return new Response(JSON.stringify({ success: true, message: "Demo data seeded successfully — requisitions, POs, GRNs, invoices, RFPs, sales orders, projects, and inventory" }), {
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
