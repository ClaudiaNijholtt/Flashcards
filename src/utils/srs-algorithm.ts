import type { Quality, CardProgress } from "../types";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

export function cardId(card: { id?: string; question: string; answer: string }): string {
	if (card.id) return card.id;
	// Deterministic fallback for cards without an id
	let hash = 0;
	const str = card.question + "\x00" + card.answer;
	for (let i = 0; i < str.length; i++) {
		hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
	}
	return Math.abs(hash).toString(36);
}

export function todayIso(): string {
	return new Date().toISOString().split("T")[0];
}

export function isCardDue(progress: CardProgress | undefined): boolean {
	if (!progress) return true; // never reviewed = always due
	return progress.dueDate <= todayIso();
}

export function computeNextProgress(
	existing: CardProgress | undefined,
	deckId: string,
	cId: string,
	quality: Quality,
): CardProgress {
	const intervalDays = existing?.intervalDays ?? 1;
	const easeFactor = existing?.easeFactor ?? DEFAULT_EASE;
	const repetitions = existing?.repetitions ?? 0;

	let newInterval: number;
	let newEase: number;
	let newReps: number;

	if (quality === 0) {
		// Failed — reset to day 1
		newInterval = 1;
		newEase = Math.max(MIN_EASE, easeFactor - 0.2);
		newReps = 0;
	} else {
		// quality 1 = twijfel, quality 2 = geweten
		if (repetitions === 0) newInterval = 1;
		else if (repetitions === 1) newInterval = 6;
		else newInterval = Math.round(intervalDays * easeFactor);

		// SM-2 ease adjustment: quality 2 → slight increase, quality 1 → slight decrease
		const delta = quality === 2 ? 0.1 : -0.15;
		newEase = Math.max(MIN_EASE, easeFactor + delta);
		newReps = repetitions + 1;
	}

	const due = new Date();
	due.setDate(due.getDate() + newInterval);
	const dueDate = due.toISOString().split("T")[0];

	return { cardId: cId, deckId, dueDate, intervalDays: newInterval, easeFactor: newEase, repetitions: newReps };
}
