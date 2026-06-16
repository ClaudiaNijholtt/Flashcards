import { supabase } from "./supabase";
import type { CardProgress, StudySession, Flashcard } from "../types";
import { cardId, todayIso } from "../utils/srs-algorithm";

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

export async function fetchStreak(): Promise<number> {
	const { data } = await supabase
		.from("study_sessions")
		.select("studied_at")
		.order("studied_at", { ascending: false })
		.limit(365);
	if (!data?.length) return 0;
	const days = new Set(data.map((r) => (r.studied_at as string).split("T")[0]));
	const today = todayIso();
	let streak = 0;
	for (let i = days.has(today) ? 0 : 1; i < 365; i++) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const iso = d.toISOString().split("T")[0];
		if (days.has(iso)) streak++;
		else break;
	}
	return streak;
}

export async function fetchAllDueCounts(
	decks: { id: string; cards: Flashcard[] }[],
): Promise<Record<string, number>> {
	if (!decks.length) return {};
	const today = todayIso();
	const { data } = await supabase
		.from("card_progress")
		.select("deck_id, card_id")
		.in("deck_id", decks.map((d) => d.id))
		.gt("due_date", today);
	const notDue: Record<string, Set<string>> = {};
	for (const row of data ?? []) {
		if (!notDue[row.deck_id]) notDue[row.deck_id] = new Set();
		notDue[row.deck_id].add(row.card_id as string);
	}
	const counts: Record<string, number> = {};
	for (const deck of decks) {
		const notDueSet = notDue[deck.id] ?? new Set<string>();
		counts[deck.id] = deck.cards.filter((c) => !notDueSet.has(cardId(c))).length;
	}
	return counts;
}
