-- Add INSERT policy to profiles table
-- Only allow users to insert their own profile (which happens via the trigger with SECURITY DEFINER)
-- This prevents unauthorized profile creation while still allowing the trigger to work

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Also add DELETE policy to prevent unauthorized deletions
CREATE POLICY "Users cannot delete profiles" 
ON public.profiles 
FOR DELETE 
USING (false);