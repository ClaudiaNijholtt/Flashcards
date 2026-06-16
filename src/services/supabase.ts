import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
	throw new Error("Maak een .env bestand aan op basis van .env.example");
}

export const supabase = createClient(url, key);
