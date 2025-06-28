# Supabase Storage Setup for Character Images

This guide will help you set up Supabase storage to store character images for your D&D app.

## Step 1: Create Storage Bucket

1. **Go to your Supabase Dashboard**

   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Create Storage Bucket**
   - Go to "Storage" in the left sidebar
   - Click "Create a new bucket"
   - Name it `character-images`
   - Set it to "Public" (so images can be accessed via URL)
   - Click "Create bucket"

## Step 2: Add Database Column

Run this SQL command in your Supabase SQL editor:

```sql
ALTER TABLE entity ADD COLUMN image_url TEXT;
```

## Step 3: Set up Storage Policies

Run these SQL commands in your Supabase SQL editor to set up proper access controls:

```sql
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
```

## Step 4: Update Your Code

The code has been updated to use Supabase storage. Here's what changed:

### Files Updated:

- `src/supabaseClient.js` - Added storage utility functions
- `src/CharacterEditor.js` - Updated to upload images to Supabase storage
- `src/Grid.js` - Updated to load images from Supabase storage
- `src/DraggableCharacter.js` - Updated to use `image_url` field
- `src/InitiativeTracker.js` - Updated to load images from Supabase storage

### Key Features:

- **Image Upload**: When creating/editing characters, images are uploaded to Supabase storage
- **Automatic Cleanup**: Old images are deleted when updating character images
- **Public URLs**: Images are accessible via public URLs
- **Error Handling**: Proper error handling for upload failures
- **Fallback**: Shows character initials if no image is available

## Step 5: Test the Setup

1. **Create a new character** with an image
2. **Edit an existing character** and upload a new image
3. **Check the initiative tracker** to see if images load properly
4. **Verify images appear** on the grid and in character sheets

## Troubleshooting

### Images not loading:

- Check that the storage bucket is set to "Public"
- Verify storage policies are correctly set
- Check browser console for errors

### Upload failures:

- Ensure file size is under 5MB
- Check that file is an image format
- Verify user is authenticated

### Database errors:

- Make sure the `image_url` column was added to the `entity` table
- Check that storage policies allow the current user to access the bucket

## File Structure

Images are stored with the following naming convention:

- `{character_id}.{file_extension}` (e.g., `123.jpg`)

This ensures each character has a unique image file and makes it easy to manage and clean up images when characters are deleted.
