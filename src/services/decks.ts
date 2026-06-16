import { supabase } from "./supabase";
import { translateDbError } from "../utils/helpers";
import type { Deck } from "../types";

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
	});
	if (error) throw new Error(translateDbError(error, "Kon deck niet opslaan"));
}

export async function removeDeck(id: string): Promise<void> {
	const { error } = await supabase.from("decks").delete().eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon deck niet verwijderen"));
}
