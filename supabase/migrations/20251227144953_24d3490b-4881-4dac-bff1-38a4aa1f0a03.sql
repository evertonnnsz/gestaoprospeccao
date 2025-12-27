-- Adiciona campo para rastrear se o lead respondeu à mensagem
ALTER TABLE public.leads
ADD COLUMN responded boolean DEFAULT false;