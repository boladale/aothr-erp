-- Create a function to prevent negative inventory balances
CREATE OR REPLACE FUNCTION public.prevent_negative_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the new quantity would be negative
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Inventory cannot go negative. Attempted to set quantity to % for item_id % at location_id %', 
            NEW.quantity, NEW.item_id, NEW.location_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on inventory_balances to prevent negative quantities
CREATE TRIGGER prevent_negative_inventory_trigger
    BEFORE INSERT OR UPDATE ON public.inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_negative_inventory();

-- Add a comment for documentation
COMMENT ON FUNCTION public.prevent_negative_inventory() IS 'Prevents inventory balance from going negative on any insert or update operation';