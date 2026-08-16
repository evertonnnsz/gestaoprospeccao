-- Adiciona vínculo com a conta de anúncios da Meta em cada cliente
ALTER TABLE public.clients
  ADD COLUMN meta_ads_account_id TEXT;

COMMENT ON COLUMN public.clients.meta_ads_account_id IS
  'ID da conta de anúncios da Meta vinculada a este cliente (formato act_XXXXXXXXXX), usado para buscar os resultados no dashboard.';

-- Registro de alertas de vencimento já enviados (evita reenvio duplicado no mesmo dia)
CREATE TABLE public.vencimento_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('contrato', 'pagamento')),
  reference_date DATE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, alert_type, reference_date)
);

ALTER TABLE public.vencimento_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vencimento notifications"
ON public.vencimento_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vencimento notifications"
ON public.vencimento_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vencimento notifications"
ON public.vencimento_notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_vencimento_notifications_client_id
  ON public.vencimento_notifications (client_id);
