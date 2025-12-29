-- Create clients table for leads with status 'fechado'
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  project_value DECIMAL(12,2),
  project_start_date DATE,
  payment_due_date DATE,
  contract_url TEXT,
  services TEXT,
  contract_duration_months INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own clients"
ON public.clients
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
ON public.clients
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
ON public.clients
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();