-- 1. Add 'rejected' to po_status enum
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Reclassify previously-auto-cancelled-by-vendor POs (committed in separate statement so enum value is visible)
