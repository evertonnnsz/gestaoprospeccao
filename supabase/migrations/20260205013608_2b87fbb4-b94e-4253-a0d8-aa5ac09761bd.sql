-- Create enum for ad platform
CREATE TYPE public.ad_platform AS ENUM ('meta_ads', 'google_ads');

-- Create table for ad campaigns data
CREATE TABLE public.campanhas_anuncios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform ad_platform NOT NULL,
  campaign_name TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  investment NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversations_started INTEGER NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual', -- 'manual' or 'import'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campanhas_anuncios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own campaigns"
ON public.campanhas_anuncios
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.campanhas_anuncios
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.campanhas_anuncios
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.campanhas_anuncios
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_campanhas_anuncios_updated_at
BEFORE UPDATE ON public.campanhas_anuncios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_campanhas_anuncios_client_id ON public.campanhas_anuncios(client_id);
CREATE INDEX idx_campanhas_anuncios_user_id ON public.campanhas_anuncios(user_id);
CREATE INDEX idx_campanhas_anuncios_period ON public.campanhas_anuncios(period_start, period_end);