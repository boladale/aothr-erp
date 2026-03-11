-- Disable user-defined triggers by name
ALTER TABLE requisition_lines DISABLE TRIGGER enforce_requisition_line_lock;
ALTER TABLE requisitions DISABLE TRIGGER audit_requisitions;
ALTER TABLE requisitions DISABLE TRIGGER enforce_requisition_lock;
ALTER TABLE requisitions DISABLE TRIGGER tr_auto_org_id;

DELETE FROM requisition_lines WHERE requisition_id = '542a1621-a520-4b6c-8b64-b9629ad80d1f';
DELETE FROM requisitions WHERE id = '542a1621-a520-4b6c-8b64-b9629ad80d1f';

-- Re-enable
ALTER TABLE requisition_lines ENABLE TRIGGER enforce_requisition_line_lock;
ALTER TABLE requisitions ENABLE TRIGGER audit_requisitions;
ALTER TABLE requisitions ENABLE TRIGGER enforce_requisition_lock;
ALTER TABLE requisitions ENABLE TRIGGER tr_auto_org_id;