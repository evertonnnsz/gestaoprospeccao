-- Add monthly payment status column to clients table
ALTER TABLE public.clients
ADD COLUMN monthly_payment_status TEXT DEFAULT 'pending' CHECK (monthly_payment_status IN ('paid', 'overdue', 'pending'));