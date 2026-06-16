import { supabase } from "./supabase";
import { translateDbError } from "../utils/helpers";
import type { Flashcard } from "../types";

export interface DuelRow {
	id: string;
	code: string;
	host_id: string;
	guest_id: string | null;
	deck_name: string;
	cards: Flashcard[];
	status: "waiting" | "active" | "finished";
}

function makeCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createDuelInDb(deckName: string, cards: Flashcard[]): Promise<DuelRow> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Niet ingelogd");

	const code = makeCode();
	const { data, error } = await supabase
		.from("duels")
		.insert({ code, host_id: user.id, deck_name: deckName, cards })
		.select()
		.single();

	if (error) throw new Error(translateDbError(error, "Kon duel niet aanmaken — controleer of de duels-tabel bestaat in Supabase"));
	return { ...data, cards: data.cards as Flashcard[] };
}

export async function fetchDuelByCode(code: string): Promise<DuelRow> {
	const { data, error } = await supabase
		.from("duels")
		.select()
		.eq("code", code.trim().toUpperCase())
		.maybeSingle();

	if (error) throw new Error(translateDbError(error, "Kon duelcode niet opzoeken"));
	if (!data) throw new Error("Duelcode niet gevonden — controleer of de code klopt");
	if (data.status !== "waiting") throw new Error("Dit duel is al gestart of afgelopen");
	return { ...data, cards: data.cards as Flashcard[] };
}

export async function joinDuelInDb(duelId: string): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Niet ingelogd");

	const { error } = await supabase
		.from("duels")
		.update({ guest_id: user.id, status: "active" })
		.eq("id", duelId)
		.eq("status", "waiting");

	if (error) throw new Error(translateDbError(error, "Kon niet meedoen aan het duel"));
}

export async function saveDuelScore(
	duelId: string,
	isHost: boolean,
	correct: number,
	wrong: number,
	timeMs: number,
): Promise<void> {
	const fields = isHost
		? { host_correct: correct, host_wrong: wrong, host_time_ms: timeMs }
		: { guest_correct: correct, guest_wrong: wrong, guest_time_ms: timeMs };

	await supabase.from("duels").update(fields).eq("id", duelId);
}
