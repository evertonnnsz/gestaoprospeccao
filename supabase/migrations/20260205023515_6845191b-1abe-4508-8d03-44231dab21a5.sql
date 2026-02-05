-- Add custom_metrics JSONB column to store user-defined metrics
ALTER TABLE public.campanhas_anuncios 
ADD COLUMN custom_metrics jsonb DEFAULT '[]'::jsonb;

-- Add a comment explaining the structure
COMMENT ON COLUMN public.campanhas_anuncios.custom_metrics IS 'Array of custom metrics: [{"name": "Alcance", "value": 1000}, {"name": "CPM", "value": 5.50}]';