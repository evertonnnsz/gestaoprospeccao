-- Update contracts bucket to explicitly allow PDF files
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['application/pdf'],
  file_size_limit = 10485760 -- 10MB limit
WHERE id = 'contracts';