-- Create staging_leads table for imported leads waiting for review
CREATE TABLE public.staging_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  whatsapp TEXT,
  instagram TEXT,
  segment TEXT,
  observations TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  has_validation_errors BOOLEAN NOT NULL DEFAULT false,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.staging_leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staging_leads
CREATE POLICY "Users can view their own staging leads"
ON public.staging_leads
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own staging leads"
ON public.staging_leads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own staging leads"
ON public.staging_leads
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own staging leads"
ON public.staging_leads
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_staging_leads_updated_at
BEFORE UPDATE ON public.staging_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();