import { supabase } from "./supabase";
import type { CardProgress, StudySession } from "../types";

export async function fetchCardProgressMap(deckId: string): Promise<Map<string, CardProgress>> {
	const { data } = await supabase
		.from("card_progress")
		.select("*")
		.eq("deck_id", deckId);

	const map = new Map<string, CardProgress>();
	for (const row of data ?? []) {
		map.set(row.card_id as string, {
			cardId: row.card_id as string,
			deckId: row.deck_id as string,
			dueDate: row.due_date as string,
			intervalDays: row.interval_days as number,
			easeFactor: Number(row.ease_factor),
			repetitions: row.repetitions as number,
		});
	}
	return map;
}

export async function saveCardProgressBatch(progressList: CardProgress[]): Promise<void> {
	if (!progressList.length) return;
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("card_progress").upsert(
		progressList.map((p) => ({
			user_id: user.id,
			deck_id: p.deckId,
			card_id: p.cardId,
			due_date: p.dueDate,
			interval_days: p.intervalDays,
			ease_factor: p.easeFactor,
			repetitions: p.repetitions,
		})),
		{ onConflict: "user_id,deck_id,card_id" },
	);
}

export async function saveStudySession(session: StudySession): Promise<void> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("study_sessions").insert({
		user_id: user.id,
		deck_id: session.deckId,
		studied_at: session.studiedAt.toISOString(),
		cards_studied: session.cardsStudied,
		correct: session.correct,
		wrong: session.wrong,
		duration_ms: session.durationMs,
	});
}

export async function fetchStudySessions(deckId: string): Promise<StudySession[]> {
	const { data } = await supabase
		.from("study_sessions")
		.select("*")
		.eq("deck_id", deckId)
		.order("studied_at", { ascending: false })
		.limit(30);

	return (data ?? []).map((row) => ({
		deckId: row.deck_id as string,
		studiedAt: new Date(row.studied_at as string),
		cardsStudied: row.cards_studied as number,
		correct: row.correct as number,
		wrong: row.wrong as number,
		durationMs: row.duration_ms as number,
	}));
}

export async function countDueCards(deckId: string, cardIds: string[]): Promise<number> {
	if (!cardIds.length) return 0;
	const today = new Date().toISOString().split("T")[0];

	const { data } = await supabase
		.from("card_progress")
		.select("card_id")
		.eq("deck_id", deckId)
		.gt("due_date", today);

	// Cards NOT in the result set are due (never seen or overdue)
	const notDueIds = new Set((data ?? []).map((r) => r.card_id as string));
	return cardIds.filter((id) => !notDueIds.has(id)).length;
}
