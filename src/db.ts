import { supabase } from "./supabase";
import type { Deck } from "./types";

export async function fetchDecks(): Promise<Deck[]> {
	const { data, error } = await supabase
		.from("decks")
		.select("*")
		.order("created_at", { ascending: false });
	if (error) throw error;
	return (data ?? []).map((row) => ({
		id: row.id as string,
		name: row.name as string,
		cards: row.cards,
		createdAt: new Date(row.created_at as string),
	}));
}

export async function insertDeck(deck: Deck): Promise<void> {
	const { error } = await supabase.from("decks").insert({
		id: deck.id,
		name: deck.name,
		cards: deck.cards,
		created_at: deck.createdAt,
	});
	if (error) throw error;
}

export async function removeDeck(id: string): Promise<void> {
	const { error } = await supabase.from("decks").delete().eq("id", id);
	if (error) throw error;
}
