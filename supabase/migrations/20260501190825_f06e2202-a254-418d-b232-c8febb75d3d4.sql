
CREATE TABLE public.prospecting_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  desired_revenue NUMERIC NOT NULL DEFAULT 0,
  launch_ticket NUMERIC NOT NULL DEFAULT 0,
  deadline_months INTEGER NOT NULL DEFAULT 1,
  planned_conversion_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prospecting goals"
ON public.prospecting_goals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prospecting goals"
ON public.prospecting_goals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prospecting goals"
ON public.prospecting_goals FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prospecting goals"
ON public.prospecting_goals FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_prospecting_goals_updated_at
BEFORE UPDATE ON public.prospecting_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
