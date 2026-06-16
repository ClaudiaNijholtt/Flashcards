import { state } from "../state";
import { esc } from "../utils/helpers";
import { getActiveDeck } from "./study";

export function renderStudyModePick(): string {
	const deck = getActiveDeck();
	const name = deck ? esc(deck.name) : "dit deck";

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-mode-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="study-header__title">${name}</div>
    </div>

    <div class="mode-pick">
      <h2 class="mode-pick__title">Hoe wil je leren?</h2>

      <button class="mode-card" id="btn-mode-flashcard">
        <div class="mode-card__icon"><i data-lucide="layers"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Flashcards</div>
          <div class="mode-card__desc">Draai de kaart om en beoordeel zelf of je het wist. Je kunt ook twijfel aangeven.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>

      <button class="mode-card" id="btn-mode-mc">
        <div class="mode-card__icon"><i data-lucide="list-checks"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Multiple keuze</div>
          <div class="mode-card__desc">Kies het juiste antwoord uit 4 opties. Test jezelf zonder zelf te oordelen.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>
    </div>
  `;
}

export function bindStudyModePickEvents(render: () => void): void {
	document.getElementById("btn-mode-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	document.getElementById("btn-mode-flashcard")?.addEventListener("click", () => {
		state.studyMode = "flashcard";
		state.studyStartTime = Date.now();
		state.view = "study";
		render();
	});

	document.getElementById("btn-mode-mc")?.addEventListener("click", () => {
		state.studyMode = "multiple-choice";
		state.studyStartTime = Date.now();
		state.view = "study";
		render();
	});
}
