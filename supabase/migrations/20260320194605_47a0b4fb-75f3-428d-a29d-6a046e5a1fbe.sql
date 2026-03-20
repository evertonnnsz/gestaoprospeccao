
-- Create platform enum for onboarding
CREATE TYPE public.onboarding_platform AS ENUM ('geral', 'google_ads', 'meta_ads', 'site');

-- Create onboarding tasks table
CREATE TABLE public.client_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  task_order TEXT NOT NULL,
  task_name TEXT NOT NULL,
  platform onboarding_platform NOT NULL DEFAULT 'geral',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_lead_responsibility BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own onboarding tasks"
  ON public.client_onboarding_tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own onboarding tasks"
  ON public.client_onboarding_tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding tasks"
  ON public.client_onboarding_tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own onboarding tasks"
  ON public.client_onboarding_tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
