-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true);

-- Storage policies for contracts
CREATE POLICY "Users can view their own contracts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own contracts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own contracts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own contracts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);