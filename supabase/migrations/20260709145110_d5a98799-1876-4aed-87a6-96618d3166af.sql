
-- 1. Prevent self-approval: trigger blocking non-admins from changing is_approved/role fields
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change approval status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Add WITH CHECK to existing user self-update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Lock down SECURITY DEFINER functions - revoke from anon/public, keep authenticated only where needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
-- has_role is used inside RLS policies - authenticated needs execute
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 3. Fix public bucket listing on company-logos: drop broad SELECT policy (bucket stays public for URL access)
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
