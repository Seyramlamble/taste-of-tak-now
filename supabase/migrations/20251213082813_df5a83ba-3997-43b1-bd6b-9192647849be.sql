-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view published surveys" ON public.surveys;

-- Create a permissive policy that allows anyone (including anonymous) to view published surveys
CREATE POLICY "Anyone can view published surveys" 
ON public.surveys 
FOR SELECT 
USING (is_published = true);