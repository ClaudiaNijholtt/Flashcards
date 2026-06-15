import "./styles/main.scss";
import { createIcons, Trash2, LogOut, Download, Upload } from "lucide";
import { state } from "./state";
import { shuffle, showToast } from "./helpers";
import { loadDecks, clearLocalDecks } from "./storage";
import { getSessionUser, onAuthChange } from "./auth";
import { fetchDecks, insertDeck } from "./db";
import { renderHome, bindHomeEvents } from "./views/home";
import { renderStudy, bindStudyEvents, startStudy, handleCardClick, markCard, getActiveDeck } from "./views/study";
import { renderDone, bindDoneEvents } from "./views/done";
import { renderGenerating } from "./views/generating";
import { renderAuth, bindAuthEvents } from "./views/auth-view";
import type { AuthUser } from "./types";

function render(): void {
	const app = document.getElementById("app")!;

	if (!state.user) {
		app.innerHTML = renderAuth();
		bindAuthEvents();
	} else if (state.isGenerating) {
		app.innerHTML = renderGenerating();
	} else if (state.view === "home") {
		app.innerHTML = renderHome();
		bindHomeEvents(render, (id) => startStudy(id, render));
	} else if (state.view === "study") {
		app.innerHTML = renderStudy();
		bindStudyEvents(render);
	} else if (state.view === "done") {
		app.innerHTML = renderDone();
		bindDoneEvents(render);
	}

	createIcons({ icons: { Trash2, LogOut, Download, Upload } });
}

async function onLogin(user: AuthUser): Promise<void> {
	state.user = user;

	// Migrate localStorage decks to Supabase on first login
	const localDecks = loadDecks();
	if (localDecks.length > 0) {
		try {
			for (const deck of localDecks) {
				await insertDeck(deck);
			}
			clearLocalDecks();
			showToast(`${localDecks.length} lokale deck(s) gemigreerd naar je account ✓`);
		} catch {
			showToast("Migratie deels mislukt — decks staan nog lokaal", true);
		}
	}

	state.decks = await fetchDecks();
	state.view = "home";
	render();
}

document.addEventListener("keydown", (e) => {
	const tag = (e.target as HTMLElement).tagName.toLowerCase();
	if (tag === "input" || tag === "textarea") return;
	if (state.view !== "study") return;

	const deck = getActiveDeck();
	if (!deck) return;

	switch (e.key) {
		case " ":
		case "Spacebar":
			e.preventDefault();
			handleCardClick();
			break;
		case "ArrowRight":
			e.preventDefault();
			if (state.cardIndex < deck.cards.length - 1) {
				state.cardIndex++;
				state.flipped = false;
				render();
			}
			break;
		case "ArrowLeft":
			e.preventDefault();
			if (state.cardIndex > 0) {
				state.cardIndex--;
				state.flipped = false;
				render();
			}
			break;
		case "1":
			markCard(false, render);
			break;
		case "2":
			markCard(true, render);
			break;
		case "s":
		case "S":
			deck.cards = shuffle(deck.cards);
			state.cardIndex = 0;
			state.flipped = false;
			state.correct = 0;
			state.wrong = 0;
			state.missed = [];
			render();
			break;
	}
});

// Boot: check session first (handles OAuth redirect tokens automatically),
// then subscribe to future auth changes
(async () => {
	const user = await getSessionUser();
	if (user) {
		await onLogin(user);
	} else {
		render();
	}

	onAuthChange(async (user) => {
		if (user) {
			await onLogin(user);
		} else {
			state.user = null;
			state.decks = [];
			render();
		}
	});
})();
