import { supabase } from "./supabase";

export interface Profile {
	id: string;
	username: string;
}

export async function fetchProfile(userId?: string): Promise<Profile | null> {
	const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
	if (!id) return null;
	const { data } = await supabase.from("profiles").select("id, username").eq("id", id).maybeSingle();
	return data ?? null;
}

export async function saveUsername(username: string): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Niet ingelogd");
	const { error } = await supabase.from("profiles").upsert({ id: user.id, username });
	if (error) {
		if (error.code === "23505") throw new Error("Deze gebruikersnaam is al bezet");
		throw error;
	}
}
