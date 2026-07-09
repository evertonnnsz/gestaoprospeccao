-- WhatsApp follow-up automation foundation.
-- Stores message templates and send history so a WhatsApp API provider can be plugged in later.

CREATE TYPE public.whatsapp_message_status AS ENUM (
  'draft',
  'sent',
  'failed'
);

CREATE TYPE public.whatsapp_follow_up_step AS ENUM (
  'initial',
  'follow_up_1',
  'follow_up_2',
  'follow_up_3',
  'custom'
);

CREATE TABLE public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  follow_up_step whatsapp_follow_up_step NOT NULL DEFAULT 'custom',
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE public.whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.whatsapp_message_templates(id) ON DELETE SET NULL,
  follow_up_step whatsapp_follow_up_step NOT NULL DEFAULT 'custom',
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status whatsapp_message_status NOT NULL DEFAULT 'draft',
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own WhatsApp templates"
ON public.whatsapp_message_templates FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own WhatsApp templates"
ON public.whatsapp_message_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WhatsApp templates"
ON public.whatsapp_message_templates FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WhatsApp templates"
ON public.whatsapp_message_templates FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own WhatsApp logs"
ON public.whatsapp_message_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own WhatsApp logs"
ON public.whatsapp_message_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WhatsApp logs"
ON public.whatsapp_message_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_whatsapp_message_templates_user_step
  ON public.whatsapp_message_templates(user_id, follow_up_step, is_active);

CREATE INDEX idx_whatsapp_message_logs_user_lead
  ON public.whatsapp_message_logs(user_id, lead_id, created_at DESC);

CREATE INDEX idx_whatsapp_message_logs_status
  ON public.whatsapp_message_logs(user_id, status, created_at DESC);
