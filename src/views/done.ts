import { state } from "../state";
import { shuffle } from "../utils/helpers";
import { getActiveDeck, startStudy } from "./study";
import { saveCardProgressBatch, saveStudySession } from "../services/srs";
import { computeNextProgress, cardId } from "../utils/srs-algorithm";
import type { Quality } from "../types";

export function renderDone(): string {
	const total = state.correct + state.wrong;
	const pct = total > 0 ? Math.round((state.correct / total) * 100) : 0;
	const durationSec = Math.round((Date.now() - state.studyStartTime) / 1000);
	const durationLabel = durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

	const twijfel = state.missed.filter((c) => state.cardQualities[cardId(c)] === 1).length;
	const mislukt = state.missed.filter((c) => state.cardQualities[cardId(c)] === 0).length;

	return `
    <div class="done-screen">
      <div class="done-screen__pct">${pct}%</div>
      <h2>Deck afgerond!</h2>

      <div class="done-screen__breakdown">
        <span class="ok"><i data-lucide="check"></i> ${state.correct} geweten</span>
        <span class="doubt"><i data-lucide="minus"></i> ${twijfel} twijfel</span>
        <span class="no"><i data-lucide="x"></i> ${mislukt} niet geweten</span>
        <span class="done-screen__time"><i data-lucide="clock"></i> ${durationLabel}</span>
      </div>

      <div class="done-screen__btns">
        ${state.missed.length > 0 ? `<button class="btn-red" id="btn-retry"><i data-lucide="x"></i> Herhaal ${state.missed.length} kaart${state.missed.length === 1 ? "" : "en"}</button>` : ""}
        <button class="btn-primary" id="btn-restart"><i data-lucide="rotate-ccw"></i> Opnieuw</button>
        <button class="btn" id="btn-home"><i data-lucide="arrow-left"></i> Decks</button>
      </div>
    </div>
  `;
}

export function bindDoneEvents(render: () => void): void {
	// Save SRS progress + session async (fire and forget)
	void persistSession();

	document.getElementById("btn-retry")?.addEventListener("click", () => {
		const deck = getActiveDeck();
		if (!deck) return;
		deck.cards = shuffle(state.missed);
		state.cardIndex = 0;
		state.flipped = false;
		state.correct = 0;
		state.wrong = 0;
		state.missed = [];
		state.cardQualities = {};
		state.studyStartTime = Date.now();
		state.view = "study";
		render();
	});

	document.getElementById("btn-restart")?.addEventListener("click", () => {
		if (state.activeDeckId) startStudy(state.activeDeckId, render);
	});

	document.getElementById("btn-home")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});
}

async function persistSession(): Promise<void> {
	if (!state.user) return;
	const deck = getActiveDeck();
	if (!deck) return;

	const durationMs = Date.now() - state.studyStartTime;

	// Compute new SRS progress for every reviewed card
	const progressList = deck.cards.map((card) => {
		const cid = cardId(card);
		const quality: Quality = state.cardQualities[cid] ?? 0;
		return computeNextProgress(undefined, deck.id, cid, quality);
	});

	await Promise.all([
		saveCardProgressBatch(progressList),
		saveStudySession({
			deckId: deck.id,
			studiedAt: new Date(),
			cardsStudied: state.correct + state.wrong,
			correct: state.correct,
			wrong: state.wrong,
			durationMs,
		}),
	]);
}
