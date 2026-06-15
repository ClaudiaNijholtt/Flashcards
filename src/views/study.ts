import { state } from "../state";
import { esc, shuffle } from "../helpers";
import type { Deck } from "../types";

export function getActiveDeck(): Deck | undefined {
	return state.decks.find((d) => d.id === state.activeDeckId);
}

export function startStudy(deckId: string, render: () => void): void {
	state.activeDeckId = deckId;
	state.view = "study";
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
	const deck = getActiveDeck();
	if (deck) deck.cards = shuffle(deck.cards);
	render();
}

export function renderStudy(): string {
	const deck = getActiveDeck();
	if (!deck) return "";
	const card = deck.cards[state.cardIndex];
	const pct = Math.round((state.cardIndex / deck.cards.length) * 100);

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-back">← Terug</button>
      <div class="study-header__title">${esc(deck.name)}</div>
    </div>

    <div class="progress-row">
      <span>${state.cardIndex + 1} / ${deck.cards.length}</span>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="score-row">
        <span class="ok">✓ ${state.correct}</span>
        <span class="no">✗ ${state.wrong}</span>
      </div>
    </div>

    <div class="scene" id="scene" role="button" tabindex="0" aria-label="Flashcard">
      <div class="card-inner${state.flipped ? " flipped" : ""}" id="card">
        <div class="face front">
          <div class="face__deck">${esc(deck.name)}</div>
          <div class="face__q">${esc(card.question)}</div>
          <div class="face__hint"><span class="kbd">Spatie</span> of klik om te draaien</div>
        </div>
        <div class="face back">
          <div class="face__deck">${esc(deck.name)}</div>
          <div class="face__a">${esc(card.answer)}</div>
          <div class="face__hint"><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het &nbsp; klik om terug</div>
        </div>
      </div>
    </div>

    <div class="mark-row${state.flipped ? " visible" : ""}" id="mark-row">
      <button class="btn-red" id="btn-no">✗ Wist ik niet</button>
      <button class="btn-green" id="btn-ok">✓ Wist ik het</button>
    </div>

    <div class="nav-row">
      <button class="btn" id="btn-prev" ${state.cardIndex === 0 ? "disabled" : ""}>← Vorige</button>
      <button class="btn" id="btn-shuffle">⇄ Schudden</button>
      <button class="btn" id="btn-next" ${state.cardIndex === deck.cards.length - 1 ? "disabled" : ""}>Volgende →</button>
    </div>

    <div class="shortcuts" aria-hidden="true">
      <span><span class="kbd">Spatie</span> draaien</span>
      <span><span class="kbd">←</span><span class="kbd">→</span> navigeren</span>
      <span><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het</span>
      <span><span class="kbd">S</span> schudden</span>
    </div>
  `;
}

export function handleCardClick(): void {
	state.flipped = !state.flipped;
	document.getElementById("card")?.classList.toggle("flipped", state.flipped);
	document.getElementById("mark-row")?.classList.toggle("visible", state.flipped);
}

export function markCard(correct: boolean, render: () => void): void {
	if (!state.flipped) return;
	const deck = getActiveDeck();
	if (!deck) return;
	if (correct) {
		state.correct++;
	} else {
		state.wrong++;
		state.missed.push(deck.cards[state.cardIndex]);
	}
	if (state.cardIndex < deck.cards.length - 1) {
		state.cardIndex++;
		state.flipped = false;
		render();
	} else {
		state.view = "done";
		render();
	}
}

export function bindStudyEvents(render: () => void): void {
	document.getElementById("btn-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	document.getElementById("scene")?.addEventListener("click", handleCardClick);
	document.getElementById("btn-no")?.addEventListener("click", () => markCard(false, render));
	document.getElementById("btn-ok")?.addEventListener("click", () => markCard(true, render));

	document.getElementById("btn-prev")?.addEventListener("click", () => {
		if (state.cardIndex > 0) {
			state.cardIndex--;
			state.flipped = false;
			render();
		}
	});
	document.getElementById("btn-next")?.addEventListener("click", () => {
		const deck = getActiveDeck();
		if (deck && state.cardIndex < deck.cards.length - 1) {
			state.cardIndex++;
			state.flipped = false;
			render();
		}
	});
	document.getElementById("btn-shuffle")?.addEventListener("click", () => {
		const deck = getActiveDeck();
		if (deck) {
			deck.cards = shuffle(deck.cards);
			state.cardIndex = 0;
			state.flipped = false;
			state.correct = 0;
			state.wrong = 0;
			state.missed = [];
			render();
		}
	});
}
