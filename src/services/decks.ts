import { supabase } from "./supabase";
import { translateDbError } from "../utils/helpers";
import type { Deck, Flashcard } from "../types";

export async function fetchDecks(): Promise<Deck[]> {
	const { data, error } = await supabase
		.from("decks")
		.select("*")
		.order("created_at", { ascending: false });
	if (error) throw new Error(translateDbError(error, "Kon decks niet laden"));
	return (data ?? []).map((row) => ({
		id: row.id as string,
		name: row.name as string,
		cards: row.cards,
		createdAt: new Date(row.created_at as string),
		creatorUsername: (row.creator_username as string | null) ?? undefined,
		tags: (row.tags as string[] | null) ?? [],
		color: (row.color as string | null) ?? "",
	}));
}

export async function fetchDeckPlayCounts(deckIds: string[]): Promise<Record<string, number>> {
	if (deckIds.length === 0) return {};
	const { data } = await supabase
		.from("duels")
		.select("deck_id")
		.in("deck_id", deckIds)
		.eq("status", "finished");

	const counts: Record<string, number> = {};
	for (const row of data ?? []) {
		const id = row.deck_id as string;
		counts[id] = (counts[id] ?? 0) + 1;
	}
	return counts;
}

export async function insertDeck(deck: Deck): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Niet ingelogd");

	const { error } = await supabase.from("decks").insert({
		id: deck.id,
		user_id: user.id,
		name: deck.name,
		cards: deck.cards,
		created_at: deck.createdAt,
		creator_username: deck.creatorUsername ?? null,
		tags: deck.tags ?? [],
		color: deck.color ?? "",
	});
	if (error) throw new Error(translateDbError(error, "Kon deck niet opslaan"));
}

export async function removeDeck(id: string): Promise<void> {
	const { error } = await supabase.from("decks").delete().eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon deck niet verwijderen"));
}

export async function renameDeck(id: string, name: string): Promise<void> {
	const { error } = await supabase.from("decks").update({ name }).eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon decknaam niet opslaan"));
}

export async function updateDeckMeta(id: string, name: string, tags: string[], color: string): Promise<void> {
	const { error } = await supabase.from("decks").update({ name, tags, color }).eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon deck niet opslaan"));
}

export async function updateDeckCards(id: string, cards: Flashcard[]): Promise<void> {
	const { error } = await supabase.from("decks").update({ cards }).eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon kaarten niet opslaan"));
}

export async function shareDeck(deckId: string): Promise<string> {
	const { data: existing } = await supabase.from("decks").select("share_code").eq("id", deckId).single();
	if (existing?.share_code) return existing.share_code as string;

	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
	const { error } = await supabase.from("decks").update({ share_code: code }).eq("id", deckId);
	if (error) throw new Error(translateDbError(error, "Kon deelcode niet aanmaken — voeg de share_code kolom toe aan de decks tabel"));
	return code;
}

export async function fetchDeckByShareCode(code: string): Promise<{ name: string; cards: Flashcard[]; creatorUsername?: string }> {
	const { data, error } = await supabase
		.from("decks")
		.select("name, cards, creator_username")
		.eq("share_code", code.trim().toUpperCase())
		.maybeSingle();
	if (error) throw new Error(translateDbError(error, "Kon deck niet ophalen"));
	if (!data) throw new Error("Deck niet gevonden — controleer de deelcode");
	return {
		name: data.name as string,
		cards: data.cards as Flashcard[],
		creatorUsername: (data.creator_username as string | null) ?? undefined,
	};
}
