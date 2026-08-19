CREATE OR REPLACE FUNCTION public.enforce_vendor_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'pending_approval' THEN
        IF NEW.name IS DISTINCT FROM OLD.name OR
           NEW.code IS DISTINCT FROM OLD.code OR
           NEW.email IS DISTINCT FROM OLD.email OR
           NEW.phone IS DISTINCT FROM OLD.phone OR
           NEW.address IS DISTINCT FROM OLD.address OR
           NEW.city IS DISTINCT FROM OLD.city OR
           NEW.country IS DISTINCT FROM OLD.country OR
           NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
           NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
           NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number OR
           NEW.service_categories IS DISTINCT FROM OLD.service_categories OR
           NEW.project_size_capacity IS DISTINCT FROM OLD.project_size_capacity THEN
            RAISE EXCEPTION 'Vendor cannot be modified while awaiting approval. Current status: %', OLD.status;
        END IF;
    ELSIF OLD.status IN ('active', 'inactive') THEN
        IF (NEW.code IS DISTINCT FROM OLD.code)
           AND NOT (public.has_role(auth.uid(), 'admin')) THEN
            RAISE EXCEPTION 'Only an administrator can change an approved vendor code';
        END IF;
        IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_permission('vendors')) THEN
            IF NEW.name IS DISTINCT FROM OLD.name OR
               NEW.email IS DISTINCT FROM OLD.email OR
               NEW.phone IS DISTINCT FROM OLD.phone OR
               NEW.address IS DISTINCT FROM OLD.address OR
               NEW.city IS DISTINCT FROM OLD.city OR
               NEW.country IS DISTINCT FROM OLD.country OR
               NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
               NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
               NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number OR
               NEW.service_categories IS DISTINCT FROM OLD.service_categories OR
               NEW.project_size_capacity IS DISTINCT FROM OLD.project_size_capacity THEN
                RAISE EXCEPTION 'You do not have permission to edit an approved vendor';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;