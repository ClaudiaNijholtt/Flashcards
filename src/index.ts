import "./styles/main.scss";
import { createIcons, Trash2, LogOut, Download, Upload, ArrowLeft, ArrowRight, Shuffle, X, Check, RotateCcw, Swords } from "lucide";
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
import { renderDuelLobby, bindDuelLobbyEvents } from "./views/duel-lobby";
import { renderDuelStudy, bindDuelStudyEvents } from "./views/duel-study";
import { renderDuelResult, bindDuelResultEvents } from "./views/duel-result";
import { renderUsernameSetup, bindUsernameSetupEvents } from "./views/username-setup";
import { createDuelInDb, fetchDuelByCode, joinDuelInDb } from "./duel-db";
import { fetchProfile } from "./profile";
import { duelChannel } from "./duel-channel";
import { supabase } from "./supabase";
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
		bindHomeEvents(render, (id) => startStudy(id, render), handleStartDuel, handleJoinDuel);
	} else if (state.view === "study") {
		app.innerHTML = renderStudy();
		bindStudyEvents(render);
	} else if (state.view === "done") {
		app.innerHTML = renderDone();
		bindDoneEvents(render);
	} else if (state.view === "duel-lobby") {
		app.innerHTML = renderDuelLobby();
		bindDuelLobbyEvents(render);
	} else if (state.view === "duel-playing") {
		app.innerHTML = renderDuelStudy();
		bindDuelStudyEvents(render);
	} else if (state.view === "duel-result") {
		app.innerHTML = renderDuelResult();
		bindDuelResultEvents(render);
	} else if (state.view === "username-setup") {
		app.innerHTML = renderUsernameSetup();
		bindUsernameSetupEvents(render);
	}

	createIcons({ icons: { Trash2, LogOut, Download, Upload, ArrowLeft, ArrowRight, Shuffle, X, Check, RotateCcw, Swords } });
}

async function handleStartDuel(deckId: string): Promise<void> {
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck) return;
	try {
		const row = await createDuelInDb(deck.name, deck.cards);
		state.duel = {
			id: row.id,
			code: row.code,
			deckName: deck.name,
			cards: deck.cards,
			isHost: true,
			cardIndex: 0,
			flipped: false,
			correct: 0,
			wrong: 0,
			selfFinished: false,
			selfTimeMs: 0,
			startTime: 0,
			selfName: state.user?.username ?? state.user?.email?.split("@")[0] ?? "Jij",
			opponent: null,
		};
		state.view = "duel-lobby";
		render();
	} catch (err) {
		showToast(err instanceof Error ? err.message : "Duel aanmaken mislukt", true);
	}
}

async function handleJoinDuel(code: string): Promise<void> {
	try {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) throw new Error("Niet ingelogd");

		const record = await fetchDuelByCode(code);
		if (record.host_id === user.id) throw new Error("Je kunt niet je eigen duel joinen");

		await joinDuelInDb(record.id);

		const hostProfile = await fetchProfile(record.host_id);
		state.duel = {
			id: record.id,
			code: record.code,
			deckName: record.deck_name,
			cards: record.cards,
			isHost: false,
			cardIndex: 0,
			flipped: false,
			correct: 0,
			wrong: 0,
			selfFinished: false,
			selfTimeMs: 0,
			startTime: Date.now(),
			selfName: state.user?.username ?? state.user?.email?.split("@")[0] ?? "Jij",
			opponent: { cardsDone: 0, correct: 0, wrong: 0, finished: false, timeMs: 0, name: hostProfile?.username ?? "Tegenstander" },
		};

		const gameCh = supabase.channel(`duel:${record.code}`).subscribe();
		duelChannel.set(gameCh);

		state.view = "duel-playing";
		render();
	} catch (err) {
		showToast(err instanceof Error ? err.message : "Kan niet meedoen aan duel", true);
	}
}

async function onLogin(user: AuthUser): Promise<void> {
	state.user = user;

	const profile = await fetchProfile(user.id);
	if (profile) {
		state.user.username = profile.username;
	}

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

	if (!profile) {
		state.view = "username-setup";
		render();
		return;
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
