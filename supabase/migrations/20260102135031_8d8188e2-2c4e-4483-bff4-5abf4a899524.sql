-- Remove a política que permite admins verem todos os leads
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;