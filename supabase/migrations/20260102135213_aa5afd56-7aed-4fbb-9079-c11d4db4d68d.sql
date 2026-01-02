-- Remove políticas que permitem admins verem dados de outros usuários

-- Clientes
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;

-- Transações financeiras
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.financial_transactions;