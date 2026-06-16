import type { AppState } from "./types";
import { loadApiKey, loadDecks } from "./utils/storage";

export const state: AppState = {
	view: "home",
	decks: [],
	activeDeckId: null,
	cardIndex: 0,
	flipped: false,
	correct: 0,
	wrong: 0,
	missed: [],
	apiKey: loadApiKey(),
	isGenerating: false,
	generationProgress: "",
	user: null,
	duel: null,
};
