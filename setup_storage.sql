-- Add image_url column to entity table
ALTER TABLE entity ADD COLUMN image_url TEXT;

-- Storage policies for character-images bucket
-- Run these in your Supabase SQL editor after creating the bucket

-- Policy 1: Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload character images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'character-images' AND 
  auth.role() = 'authenticated'
);

-- Policy 2: Allow authenticated users to view images
CREATE POLICY "Allow authenticated users to view character images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'character-images' AND 
  auth.role() = 'authenticated'
);

-- Policy 3: Allow users to update their own images
CREATE POLICY "Allow users to update their own character images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'character-images' AND 
  auth.role() = 'authenticated'
);

-- Policy 4: Allow users to delete their own images
CREATE POLICY "Allow users to delete their own character images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'character-images' AND 
  auth.role() = 'authenticated'
); 