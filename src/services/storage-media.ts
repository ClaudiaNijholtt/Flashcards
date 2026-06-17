/*
SUPABASE SETUP (run once in Supabase dashboard):

card-images bucket:
1. Storage → Create bucket → name: "card-images", Public: YES
2. SQL editor:
   CREATE POLICY "Anyone can read card images" ON storage.objects
     FOR SELECT USING (bucket_id = 'card-images');
   CREATE POLICY "Auth users can upload card images" ON storage.objects
     FOR INSERT WITH CHECK (bucket_id = 'card-images' AND auth.uid() IS NOT NULL);
   CREATE POLICY "Auth users can delete own card images" ON storage.objects
     FOR DELETE USING (bucket_id = 'card-images' AND auth.uid() IS NOT NULL);

card-audio bucket:
1. Storage → Create bucket → name: "card-audio", Public: YES
2. SQL editor:
   CREATE POLICY "Anyone can read card audio" ON storage.objects
     FOR SELECT USING (bucket_id = 'card-audio');
   CREATE POLICY "Auth users can upload card audio" ON storage.objects
     FOR INSERT WITH CHECK (bucket_id = 'card-audio' AND auth.uid() IS NOT NULL);
   CREATE POLICY "Auth users can delete card audio" ON storage.objects
     FOR DELETE USING (bucket_id = 'card-audio' AND auth.uid() IS NOT NULL);
*/

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

export async function uploadCardAudio(file: Blob, userId: string, cardId: string, ext = "webm"): Promise<string> {
  const path = `${userId}/${cardId}.${ext}`;
  const { error } = await supabase.storage.from("card-audio").upload(path, file, { upsert: true, contentType: `audio/${ext}` });
  if (error) throw new Error("Audio uploaden mislukt: " + error.message);
  const { data: { publicUrl } } = supabase.storage.from("card-audio").getPublicUrl(path);
  return publicUrl;
}

export async function deleteCardAudio(url: string): Promise<void> {
  const path = url.split("/card-audio/")[1];
  if (path) await supabase.storage.from("card-audio").remove([path]);
}
