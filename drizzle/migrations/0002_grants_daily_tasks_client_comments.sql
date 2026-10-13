-- Grants para a Data API (não incluídos nos arquivos originais)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_tasks TO authenticated;
GRANT ALL ON public.daily_tasks TO service_role;
GRANT SELECT, INSERT, DELETE ON public.client_comments TO authenticated;
GRANT ALL ON public.client_comments TO service_role;