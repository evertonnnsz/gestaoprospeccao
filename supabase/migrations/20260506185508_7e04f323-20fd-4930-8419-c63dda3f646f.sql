
CREATE TABLE public.lead_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status lead_status NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lsh_lead_status ON public.lead_status_history(lead_id, status);
CREATE INDEX idx_lsh_user_changed ON public.lead_status_history(user_id, changed_at);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lead status history"
ON public.lead_status_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead status history"
ON public.lead_status_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lead status history"
ON public.lead_status_history FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead status history"
ON public.lead_status_history FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status IS NOT NULL THEN
      INSERT INTO public.lead_status_history (lead_id, user_id, status, changed_at)
      VALUES (NEW.id, NEW.user_id, NEW.status, COALESCE(NEW.created_at, now()));
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS NOT NULL THEN
      INSERT INTO public.lead_status_history (lead_id, user_id, status, changed_at)
      VALUES (NEW.id, NEW.user_id, NEW.status, now());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lead_status_change
AFTER INSERT OR UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_status_change();

-- Backfill com o status atual de cada lead existente
INSERT INTO public.lead_status_history (lead_id, user_id, status, changed_at)
SELECT id, user_id, status, COALESCE(created_at, now())
FROM public.leads
WHERE status IS NOT NULL;
