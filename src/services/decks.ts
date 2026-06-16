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
	}));
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
	});
	if (error) throw new Error(translateDbError(error, "Kon deck niet opslaan"));
}

export async function removeDeck(id: string): Promise<void> {
	const { error } = await supabase.from("decks").delete().eq("id", id);
	if (error) throw new Error(translateDbError(error, "Kon deck niet verwijderen"));
}
