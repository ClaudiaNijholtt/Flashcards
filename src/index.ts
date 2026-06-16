import "./styles/main.scss";
import { createIcons, Trash2, LogOut, Download, Upload, ArrowLeft, ArrowRight, Shuffle, X, Check, RotateCcw, Swords, BookOpen, TriangleAlert, Settings, BarChart2, Minus, Clock, User, Eye, EyeOff, Layers, ListChecks, Moon, Sun, Pencil, Save, Plus, Flame, Ellipsis } from "lucide";
import { state } from "./state";
import { showToast } from "./utils/helpers";
import { loadDecks, clearLocalDecks } from "./utils/storage";
import { getSessionUser, onAuthChange } from "./services/auth";
import { fetchDecks, insertDeck, fetchDeckPlayCounts } from "./services/decks";
import { fetchStreak, fetchAllDueCounts } from "./services/srs";
import { renderHome, bindHomeEvents } from "./views/home";
import { renderStudy, bindStudyEvents, startStudy, startDueStudy, handleCardClick, markCard, undoLastCard, getActiveDeck, reshuffleStudy } from "./views/study";
import { renderStudyModePick, bindStudyModePickEvents } from "./views/study-mode-pick";
import { renderDone, bindDoneEvents } from "./views/done";
import { renderGenerating } from "./views/generating";
import { renderAuth, bindAuthEvents } from "./views/auth-view";
import { renderDuelLobby, bindDuelLobbyEvents } from "./views/duel-lobby";
import { renderDuelStudy, bindDuelStudyEvents } from "./views/duel-study";
import { renderDuelResult, bindDuelResultEvents } from "./views/duel-result";
import { renderUsernameSetup, bindUsernameSetupEvents } from "./views/username-setup";
import { renderStats, bindStatsEvents } from "./views/stats";
import { renderProfile, bindProfileEvents } from "./views/profile";
import { renderDeckEdit, bindDeckEditEvents } from "./views/deck-edit";
import { createDuelInDb, fetchDuelByCode, joinDuelInDb } from "./services/duels";
import { fetchProfile } from "./services/profiles";
import { duelChannel } from "./services/realtime";
import { supabase } from "./services/supabase";
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
		bindHomeEvents(render, (id) => startStudy(id, render), handleStartDuel, handleJoinDuel, handleStartStats, () => { state.view = "profile"; render(); }, (id) => { state.editDeckId = id; state.view = "deck-edit"; render(); }, (id) => { void startDueStudy(id, render); });
	} else if (state.view === "study-mode-pick") {
		app.innerHTML = renderStudyModePick();
		bindStudyModePickEvents(render);
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
	} else if (state.view === "stats") {
		app.innerHTML = renderStats();
		bindStatsEvents(render);
	} else if (state.view === "profile") {
		app.innerHTML = renderProfile();
		bindProfileEvents(render);
	} else if (state.view === "deck-edit") {
		app.innerHTML = renderDeckEdit();
		bindDeckEditEvents(render);
	}

	createIcons({ icons: { Trash2, LogOut, Download, Upload, ArrowLeft, ArrowRight, Shuffle, X, Check, RotateCcw, Swords, BookOpen, TriangleAlert, Settings, BarChart2, Minus, Clock, User, Eye, EyeOff, Layers, ListChecks, Moon, Sun, Pencil, Save, Plus, Flame, Ellipsis } });
}

function handleStartStats(deckId: string): void {
	state.activeDeckId = deckId;
	state.view = "stats";
	render();
}

async function handleStartDuel(deckId: string): Promise<void> {
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck) return;
	try {
		const row = await createDuelInDb(deck.name, deck.id, deck.cards);
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
	[state.deckPlayCounts, state.streak, state.deckDueCounts] = await Promise.all([
		fetchDeckPlayCounts(state.decks.map((d) => d.id)),
		fetchStreak(),
		fetchAllDueCounts(state.decks),
	]);
	state.view = "home";
	render();
}

document.addEventListener("keydown", (e) => {
	const tag = (e.target as HTMLElement).tagName.toLowerCase();
	if (tag === "input" || tag === "textarea") return;
	if (state.view !== "study" || state.studyMode !== "flashcard") return;

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
			markCard(0, render);
			break;
		case "2":
			markCard(1, render);
			break;
		case "3":
			markCard(2, render);
			break;
		case "u":
		case "U":
			undoLastCard(render);
			break;
		case "s":
		case "S":
			reshuffleStudy(render);
			break;
	}
});

// Apply saved theme before first render to avoid flash
if (localStorage.getItem("theme") === "dark") {
	document.documentElement.setAttribute("data-theme", "dark");
}

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
