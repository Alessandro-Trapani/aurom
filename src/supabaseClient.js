import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Debug: Check if environment variables are being read
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseAnonKey);
console.log(
  "Supabase Key length:",
  supabaseAnonKey ? supabaseAnonKey.length : 0
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage utility functions
export const uploadCharacterImage = async (file, characterId) => {
  try {
    console.log("Starting image upload for character:", characterId);
    console.log("File details:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    const fileExt = file.name.split(".").pop();
    const fileName = `${characterId}.${fileExt}`;

    console.log("Uploading file as:", fileName);

    const { data, error } = await supabase.storage
      .from("character-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      console.error("Error details:", {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error,
      });
      throw error;
    }

    console.log("Upload successful, data:", data);

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("character-images").getPublicUrl(fileName);

    console.log("Public URL generated:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    throw error;
  }
};

export const getCharacterImageUrl = async (characterId) => {
  try {
    const { data, error } = await supabase.storage
      .from("character-images")
      .list("", {
        search: `${characterId}.`,
      });

    if (error) throw error;

    if (data && data.length > 0) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("character-images").getPublicUrl(data[0].name);

      return publicUrl;
    }

    return null;
  } catch (error) {
    console.error("Error getting image URL:", error);
    return null;
  }
};

export const deleteCharacterImage = async (characterId) => {
  try {
    const { data, error } = await supabase.storage
      .from("character-images")
      .list("", {
        search: `${characterId}.`,
      });

    if (error) throw error;

    if (data && data.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from("character-images")
        .remove([data[0].name]);

      if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};
