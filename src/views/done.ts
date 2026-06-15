import { state } from "../state";
import { shuffle } from "../helpers";
import { getActiveDeck, startStudy } from "./study";

export function renderDone(): string {
	const total = state.correct + state.wrong;
	const pct = total > 0 ? Math.round((state.correct / total) * 100) : 0;

	return `
    <div class="done-screen">
      <div class="done-screen__pct">${pct}%</div>
      <h2>Deck afgerond!</h2>
      <p>${state.correct} van de ${total} kaarten goed.</p>
      <div class="done-screen__btns">
        ${state.missed.length > 0 ? `<button class="btn-red" id="btn-retry"><i data-lucide="x"></i> Herhaal ${state.missed.length} gemiste kaart${state.missed.length === 1 ? "" : "en"}</button>` : ""}
        <button class="btn-primary" id="btn-restart"><i data-lucide="rotate-ccw"></i> Opnieuw</button>
        <button class="btn" id="btn-home"><i data-lucide="arrow-left"></i> Decks</button>
      </div>
    </div>
  `;
}

export function bindDoneEvents(render: () => void): void {
	document.getElementById("btn-retry")?.addEventListener("click", () => {
		const deck = getActiveDeck();
		if (!deck) return;
		deck.cards = shuffle(state.missed);
		state.cardIndex = 0;
		state.flipped = false;
		state.correct = 0;
		state.wrong = 0;
		state.missed = [];
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
