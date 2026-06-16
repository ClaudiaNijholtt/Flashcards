import { supabase } from "./supabase";
import { translateDbError } from "../utils/helpers";
import type { UserTag } from "../types";

export interface Profile {
	id: string;
	username: string;
	tagLibrary: UserTag[];
}

export async function fetchProfile(userId?: string): Promise<Profile | null> {
	const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
	if (!id) return null;

	// Try with tag_library; fall back gracefully if column doesn't exist yet
	const { data, error } = await supabase
		.from("profiles")
		.select("id, username, tag_library")
		.eq("id", id)
		.maybeSingle();

	if (error) {
		// Column probably missing — retry without it so login doesn't break
		const { data: basic } = await supabase
			.from("profiles")
			.select("id, username")
			.eq("id", id)
			.maybeSingle();
		if (!basic) return null;
		return { id: basic.id as string, username: basic.username as string, tagLibrary: [] };
	}

	if (!data) return null;
	return {
		id: data.id as string,
		username: data.username as string,
		tagLibrary: (data.tag_library as UserTag[] | null) ?? [],
	};
}

export async function saveUsername(username: string): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Niet ingelogd");

	const { error } = await supabase.from("profiles").upsert({ id: user.id, username });
	if (error) {
		if (error.code === "23505") throw new Error("Deze gebruikersnaam is al bezet, kies een andere");
		throw new Error(translateDbError(error, "Kon gebruikersnaam niet opslaan"));
	}
}

// Best-effort sync to Supabase — never throws.
// Tags are always stored in localStorage first; this is just cloud backup.
export async function saveTagLibrary(tags: UserTag[]): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;
	await supabase.from("profiles").update({ tag_library: tags }).eq("id", user.id);
	// Ignore errors (column may not exist until migration is run)
}
