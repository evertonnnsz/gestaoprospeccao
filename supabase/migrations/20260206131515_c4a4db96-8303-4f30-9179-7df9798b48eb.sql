
ALTER TABLE public.leads ADD COLUMN cnpj text;
ALTER TABLE public.leads ADD COLUMN razao_social text;
ALTER TABLE public.leads ADD COLUMN nome_fantasia text;
ALTER TABLE public.leads ADD COLUMN endereco_completo text;

ALTER TABLE public.staging_leads ADD COLUMN cnpj text;
ALTER TABLE public.staging_leads ADD COLUMN razao_social text;
ALTER TABLE public.staging_leads ADD COLUMN nome_fantasia text;
ALTER TABLE public.staging_leads ADD COLUMN endereco_completo text;
