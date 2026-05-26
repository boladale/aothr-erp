DO $$
DECLARE
  v_org record;
  v_rule_id uuid;
  v_rule_name text;
BEGIN
  FOR v_org IN SELECT id, code FROM public.organizations LOOP
    v_rule_name := 'Default PO Approval (Manager → Finance) [' || v_org.code || ']';

    IF EXISTS (
      SELECT 1 FROM public.approval_rules
      WHERE entity_type = 'purchase_orders'
        AND organization_id = v_org.id
        AND rule_name LIKE 'Default PO Approval%'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.approval_rules (entity_type, rule_name, conditions, is_active, priority, organization_id)
    VALUES (
      'purchase_orders',
      v_rule_name,
      '{}'::jsonb,
      true,
      100,
      v_org.id
    )
    RETURNING id INTO v_rule_id;

    INSERT INTO public.approval_steps (rule_id, step_order, step_type, approver_role)
    VALUES
      (v_rule_id, 1, 'sequential', 'procurement_manager'),
      (v_rule_id, 2, 'sequential', 'finance_manager');
  END LOOP;
END $$;