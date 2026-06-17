// SUPABASE SETUP (run once in Supabase dashboard):
// 1. Go to Storage → Create bucket → name: "card-images", Public: YES
// 2. In SQL editor run:
//    CREATE POLICY "Anyone can read card images" ON storage.objects
//      FOR SELECT USING (bucket_id = 'card-images');
//    CREATE POLICY "Auth users can upload card images" ON storage.objects
//      FOR INSERT WITH CHECK (bucket_id = 'card-images' AND auth.uid() IS NOT NULL);
//    CREATE POLICY "Auth users can delete own card images" ON storage.objects
//      FOR DELETE USING (bucket_id = 'card-images' AND auth.uid() IS NOT NULL);
import { supabase } from "./supabase";

export async function uploadCardImage(file: File, userId: string, cardId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${cardId}.${ext}`;
  const { error } = await supabase.storage.from("card-images").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error("Afbeelding uploaden mislukt: " + error.message);
  const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(path);
  return publicUrl;
}

export async function deleteCardImage(userId: string, cardId: string, ext: string): Promise<void> {
  await supabase.storage.from("card-images").remove([`${userId}/${cardId}.${ext}`]);
}
