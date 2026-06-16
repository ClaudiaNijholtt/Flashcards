import { state } from "../state";
import { esc, formatDate, showToast } from "../utils/helpers";
import { saveApiKey, saveDecks, deleteDeck } from "../utils/storage";
import { signOut } from "../services/auth";
import { insertDeck, removeDeck, fetchDecks } from "../services/decks";
import { generateFlashcards } from "../services/ai";
import type { Deck } from "../types";

export function renderHome(): string {
	const hasKey = !!state.apiKey;
	const totalCards = state.decks.reduce((sum, d) => sum + d.cards.length, 0);
	const firstName = state.user?.username ?? state.user?.email?.split("@")[0] ?? "";

	const statsHtml = state.decks.length > 0
		? `<div class="home-stats">
        <div class="home-stat">
          <span class="home-stat__num">${state.decks.length}</span>
          <span class="home-stat__label">deck${state.decks.length !== 1 ? "s" : ""}</span>
        </div>
        <span class="home-stat__sep">·</span>
        <div class="home-stat">
          <span class="home-stat__num">${totalCards}</span>
          <span class="home-stat__label">kaarten</span>
        </div>
      </div>`
		: "";

	const decksHtml = state.decks.length === 0
		? `<div class="home-empty">
        <i data-lucide="book-open"></i>
        <p>Je hebt nog geen decks. Upload een document hieronder om te beginnen.</p>
      </div>`
		: `<div class="section-header">
        <div class="section-title">Mijn decks</div>
      </div>
      <div class="deck-list">
        ${state.decks.map((deck) => `
          <div class="deck-card" data-id="${deck.id}">
            <div class="deck-card__icon" aria-hidden="true"><i data-lucide="book-open"></i></div>
            <div class="deck-card__info">
              <div class="deck-card__name">${esc(deck.name)}</div>
              <div class="deck-card__meta">${deck.cards.length} kaarten &nbsp;·&nbsp; ${formatDate(deck.createdAt)}</div>
            </div>
            <div class="deck-card__actions">
              <button class="btn-primary deck-card__study" data-study="${deck.id}">
                Leren <i data-lucide="arrow-right"></i>
              </button>
              <button class="btn-icon" data-stats="${deck.id}" title="Statistieken" aria-label="Statistieken bekijken">
                <i data-lucide="bar-chart-2"></i>
              </button>
              <button class="btn-icon" data-duel="${deck.id}" title="Duel starten" aria-label="Duel starten">
                <i data-lucide="swords"></i>
              </button>
              <button class="btn-icon" data-export="${deck.id}" title="Exporteren" aria-label="Exporteren">
                <i data-lucide="download"></i>
              </button>
              <button class="btn-icon" data-delete="${deck.id}" title="Verwijderen" aria-label="Verwijderen">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>`).join("")}
      </div>`;

	const apiBannerHtml = !hasKey
		? `<div class="api-banner">
        <i data-lucide="triangle-alert"></i>
        <div class="api-banner__body">
          <div class="api-banner__title">API-sleutel vereist om decks te genereren</div>
          <div class="api-banner__form">
            <input type="password" id="api-input" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" />
            <button class="btn-primary" id="api-save">Opslaan</button>
          </div>
        </div>
      </div>`
		: "";

	const apiSettingsHtml = hasKey
		? `<div class="api-settings">
        <details>
          <summary><i data-lucide="settings"></i> API-sleutel wijzigen</summary>
          <div class="api-settings__body">
            <input type="password" id="api-input" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" />
            <button class="btn" id="api-save">Opslaan</button>
          </div>
        </details>
      </div>`
		: "";

	return `
    <div class="topbar">
      <span class="topbar__brand">Flashcards</span>
      <div class="topbar__user">
        <button class="topbar__profile-btn" id="btn-profile" title="Profiel" aria-label="Profiel bekijken">
          <i data-lucide="user"></i>
          <span class="topbar__name">${esc(firstName)}</span>
        </button>
        <button class="btn-icon" id="btn-logout" title="Uitloggen" aria-label="Uitloggen">
          <i data-lucide="log-out"></i>
        </button>
      </div>
    </div>

    <div class="home-hero">
      <h1>Welkom terug${firstName ? `, ${esc(firstName)}` : ""}!</h1>
      ${statsHtml}
    </div>

    ${apiBannerHtml}
    ${decksHtml}

    <div class="add-section">
      <div class="section-title">Deck toevoegen</div>
      <div class="upload-zone ${!hasKey ? "disabled" : ""}" id="upload-zone" role="button" tabindex="0" aria-label="Document uploaden">
        <input type="file" id="file-input" accept=".pdf,.txt,.md" multiple />
        <div class="upload-zone__icon"></div>
        <div class="upload-zone__title">Klik of sleep een document</div>
        <div class="upload-zone__sub">PDF, TXT of Markdown</div>
      </div>
      <div class="add-actions">
        <input type="file" id="json-input" accept=".json" style="display:none" />
        <button class="btn" id="btn-import-json"><i data-lucide="upload"></i> Importeren via JSON</button>
        <button class="btn" id="btn-join-duel-toggle"><i data-lucide="swords"></i> Duel meedoen</button>
      </div>
      <div class="duel-join-panel hidden" id="duel-join-panel">
        <div class="duel-join-form">
          <input type="text" id="duel-code-home" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters" />
          <button class="btn-primary" id="btn-home-join-duel">Meedoen <i data-lucide="arrow-right"></i></button>
        </div>
        <p id="duel-home-error" class="duel-lobby__error hidden"></p>
      </div>
    </div>

    ${apiSettingsHtml}
  `;
}

export function bindHomeEvents(
	render: () => void,
	startStudy: (id: string) => void,
	startDuel: (deckId: string) => void,
	joinDuel: (code: string) => void,
	startStats: (deckId: string) => void,
	goToProfile: () => void,
): void {
	document.getElementById("btn-profile")?.addEventListener("click", goToProfile);

	document.getElementById("btn-logout")?.addEventListener("click", async () => {
		await signOut();
		state.user = null;
		state.decks = [];
		render();
	});

	document.getElementById("api-save")?.addEventListener("click", () => {
		const input = document.getElementById("api-input") as HTMLInputElement;
		const key = input.value.trim();
		if (!key) {
			showToast("Voer een geldige API-sleutel in", true);
			return;
		}
		state.apiKey = key;
		saveApiKey(key);
		showToast("API-sleutel opgeslagen ✓");
		render();
	});

	const zone = document.getElementById("upload-zone")!;
	const fileInput = document.getElementById("file-input") as HTMLInputElement;

	zone?.addEventListener("click", () => {
		if (!state.apiKey) {
			showToast("Stel eerst een API-sleutel in", true);
			return;
		}
		fileInput.click();
	});
	zone?.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zone.click(); }
	});
	zone?.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
	zone?.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
	zone?.addEventListener("drop", (e) => {
		e.preventDefault();
		zone.classList.remove("drag-over");
		const files = Array.from(e.dataTransfer?.files ?? []);
		if (files.length) handleFiles(files, render);
	});
	fileInput?.addEventListener("change", () => {
		const files = Array.from(fileInput.files ?? []);
		if (files.length) handleFiles(files, render);
	});

	// Export deck as JSON
	document.querySelectorAll<HTMLElement>("[data-export]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const deck = state.decks.find((d) => d.id === btn.dataset.export);
			if (!deck) return;
			const json = JSON.stringify({ name: deck.name, cards: deck.cards }, null, 2);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${deck.name.replace(/[^a-z0-9]/gi, "_")}.json`;
			a.click();
			URL.revokeObjectURL(url);
		});
	});

	// Import deck from JSON
	const jsonInput = document.getElementById("json-input") as HTMLInputElement;
	document.getElementById("btn-import-json")?.addEventListener("click", () => jsonInput.click());
	jsonInput?.addEventListener("change", async () => {
		const file = jsonInput.files?.[0];
		if (!file) return;
		jsonInput.value = "";
		try {
			const data = JSON.parse(await file.text());
			if (!isValidDeckJson(data)) {
				showToast("Ongeldig JSON-formaat — verwacht: { name, cards: [{ question, answer }] }", true);
				return;
			}
			const deck: Deck = {
				id: Date.now().toString(),
				name: data.name,
				cards: data.cards.map((c: { id?: string; question: string; answer: string }) => ({
					id: c.id ?? crypto.randomUUID(),
					question: c.question,
					answer: c.answer,
				})),
				createdAt: new Date(),
			};
			if (state.user) {
				await insertDeck(deck);
				state.decks = await fetchDecks();
			} else {
				state.decks.push(deck);
				saveDecks(state.decks);
			}
			showToast(`"${esc(data.name)}" geïmporteerd ✓`);
			render();
		} catch {
			showToast("Kan JSON-bestand niet lezen", true);
		}
	});

	// Deck: click card or study button → study
	document.querySelectorAll<HTMLElement>(".deck-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			const t = e.target as HTMLElement;
			if (t.closest("[data-delete]") || t.closest("[data-duel]") || t.closest("[data-export]") || t.closest("[data-study]") || t.closest("[data-stats]")) return;
			startStudy(card.dataset.id!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-study]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startStudy(btn.dataset.study!);
		});
	});

	// Delete deck
	document.querySelectorAll<HTMLElement>("[data-delete]").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const id = btn.dataset.delete!;
			if (!confirm("Deck verwijderen?")) return;
			try {
				if (state.user) {
					await removeDeck(id);
					state.decks = state.decks.filter((d) => d.id !== id);
				} else {
					state.decks = deleteDeck(id, state.decks);
				}
				render();
			} catch (err) {
				showToast(err instanceof Error ? err.message : "Verwijderen mislukt", true);
			}
		});
	});

	// Stats per deck
	document.querySelectorAll<HTMLElement>("[data-stats]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startStats(btn.dataset.stats!);
		});
	});

	// Duel: start from deck
	document.querySelectorAll<HTMLElement>("[data-duel]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startDuel(btn.dataset.duel!);
		});
	});

	// Duel: join toggle
	document.getElementById("btn-join-duel-toggle")?.addEventListener("click", () => {
		const panel = document.getElementById("duel-join-panel");
		panel?.classList.toggle("hidden");
		if (!panel?.classList.contains("hidden")) {
			(document.getElementById("duel-code-home") as HTMLInputElement)?.focus();
		}
	});

	// Duel: join by code
	const codeInput = document.getElementById("duel-code-home") as HTMLInputElement | null;
	codeInput?.addEventListener("input", () => {
		codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
	});
	codeInput?.addEventListener("keydown", (e) => {
		if (e.key === "Enter") document.getElementById("btn-home-join-duel")?.click();
	});
	document.getElementById("btn-home-join-duel")?.addEventListener("click", () => {
		const code = codeInput?.value.trim() ?? "";
		if (code.length !== 6) {
			showDuelError("Voer een geldige 6-teken code in");
			return;
		}
		joinDuel(code);
	});
}

function showDuelError(msg: string): void {
	const el = document.getElementById("duel-home-error");
	if (el) { el.textContent = msg; el.classList.remove("hidden"); }
}

function isValidDeckJson(data: unknown): data is { name: string; cards: { question: string; answer: string }[] } {
	if (typeof data !== "object" || data === null) return false;
	const d = data as Record<string, unknown>;
	if (typeof d.name !== "string" || !d.name.trim()) return false;
	if (!Array.isArray(d.cards) || d.cards.length === 0) return false;
	return d.cards.every(
		(c) => typeof c === "object" && c !== null &&
			typeof (c as Record<string, unknown>).question === "string" &&
			typeof (c as Record<string, unknown>).answer === "string",
	);
}

async function handleFiles(files: File[], render: () => void): Promise<void> {
	if (!state.apiKey) {
		showToast("Stel eerst een API-sleutel in", true);
		return;
	}

	for (const file of files) {
		state.isGenerating = true;
		state.generationProgress = "Starten...";
		render();

		try {
			const cards = await generateFlashcards(
				state.apiKey,
				file,
				(msg) => {
					state.generationProgress = msg;
					const el = document.querySelector(".generating__msg");
					if (el) el.textContent = msg;
				},
			);

			const deck: Deck = {
				id: Date.now().toString(),
				name: file.name.replace(/\.[^.]+$/, ""),
				cards,
				createdAt: new Date(),
			};

			state.decks.push(deck);
			if (state.user) {
				await insertDeck(deck);
				state.decks = await fetchDecks();
			} else {
				saveDecks(state.decks);
			}
			showToast(`${cards.length} flashcards aangemaakt ✓`);
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Onbekende fout", true);
		}
	}

	state.isGenerating = false;
	state.view = "home";
	render();
}
