import { state } from "../state";
import { esc } from "../utils/helpers";
import { getActiveDeck } from "./study";

export function renderStudyModePick(): string {
	const deck = getActiveDeck();
	const name = deck ? esc(deck.name) : "dit deck";
	const hasDeck = state.activeDeckId !== null;

	const speelHtml = hasDeck ? `
      <h2 class="mode-pick__title" style="margin-top:1.5rem">Spelen</h2>

      <button class="mode-card" id="btn-mode-duel">
        <div class="mode-card__icon"><i data-lucide="swords"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Duel starten</div>
          <div class="mode-card__desc">Speel dit deck tegelijk met een vriend. Wie is het snelst en meest accuraat?</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>

      <button class="mode-card" id="btn-mode-quiz">
        <div class="mode-card__icon"><i data-lucide="layout-grid"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Quiz starten</div>
          <div class="mode-card__desc">Host een live quiz voor meerdere spelers. Iedereen doet mee met een code.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>

      <button class="mode-card" id="btn-mode-match">
        <div class="mode-card__icon"><i data-lucide="grid-2x2"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Matchspel</div>
          <div class="mode-card__desc">Koppel begrippen aan hun definities zo snel mogelijk. Oefen herkenning.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>` : "";

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-mode-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="study-header__title">${name}</div>
    </div>

    <div class="mode-pick">
      <h2 class="mode-pick__title">Leren</h2>

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
          <div class="mode-card__name">Meerkeuze</div>
          <div class="mode-card__desc">Kies het juiste antwoord uit 4 opties. Test jezelf zonder zelf te oordelen.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>

      <button class="mode-card" id="btn-mode-type">
        <div class="mode-card__icon"><i data-lucide="keyboard"></i></div>
        <div class="mode-card__body">
          <div class="mode-card__name">Invullen</div>
          <div class="mode-card__desc">Typ het antwoord zelf in. Test je actieve herinnering zonder hulp van opties.</div>
        </div>
        <i data-lucide="arrow-right" class="mode-card__arrow"></i>
      </button>
      ${speelHtml}
    </div>
  `;
}

export function bindStudyModePickEvents(
	render: () => void,
	startDuel: (id: string) => void,
	startQuiz: (id: string) => void,
	startMatch: (id: string) => void,
): void {
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

	document.getElementById("btn-mode-type")?.addEventListener("click", () => {
		state.studyMode = "type-answer";
		state.studyStartTime = Date.now();
		state.view = "study";
		render();
	});

	if (state.activeDeckId) {
		const deckId = state.activeDeckId;
		document.getElementById("btn-mode-duel")?.addEventListener("click", () => startDuel(deckId));
		document.getElementById("btn-mode-quiz")?.addEventListener("click", () => startQuiz(deckId));
		document.getElementById("btn-mode-match")?.addEventListener("click", () => startMatch(deckId));
	}
}
