import type { AppState } from "./types";
import { loadApiKey, loadDecks } from "./storage";

export const state: AppState = {
	view: "home",
	decks: loadDecks(),
	activeDeckId: null,
	cardIndex: 0,
	flipped: false,
	correct: 0,
	wrong: 0,
	missed: [],
	apiKey: loadApiKey(),
	isGenerating: false,
	generationProgress: "",
};
