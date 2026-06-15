import { state } from "../state";
import { esc, formatDate, showToast } from "../helpers";
import { saveApiKey, saveDecks, deleteDeck } from "../storage";
import { signOut } from "../auth";
import { insertDeck, removeDeck, fetchDecks } from "../db";
import { generateFlashcards } from "../api";
import type { Deck } from "../types";

export function renderHome(): string {
	const hasKey = !!state.apiKey;
	const decksHtml =
		state.decks.length === 0
			? `<p style="text-align:center;padding:1.5rem 0">Nog geen decks. Upload een document om te beginnen.</p>`
			: state.decks
					.map(
						(deck) => `
      <div class="deck-card" data-id="${deck.id}">
        <div class="deck-card__info">
          <div class="deck-card__name">${esc(deck.name)}</div>
          <div class="deck-card__meta">${deck.cards.length} kaarten &nbsp;·&nbsp; ${formatDate(deck.createdAt)}</div>
        </div>
        <div class="deck-card__actions">
          <button class="btn-icon" data-export="${deck.id}" title="Exporteren als JSON" aria-label="Deck exporteren als JSON"><i data-lucide="download"></i></button>
          <button class="btn-icon" data-delete="${deck.id}" title="Verwijderen" aria-label="Deck verwijderen"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`,
					)
					.join("");

	const userBar = state.user
		? `<div class="user-bar">
        <span>Ingelogd als ${esc(state.user.email ?? state.user.id)}</span>
        <button class="btn" id="btn-logout"><i data-lucide="log-out"></i> Uitloggen</button>
      </div>`
		: "";

	return `
    ${userBar}
    <div class="app-header">
      <h1>Flashcard Generator</h1>
      <p>Upload een document en laat AI flashcards maken</p>
    </div>

    <div class="api-key-section">
      <div class="api-key-section__header" id="api-toggle">
        <div class="api-key-section__title">
          <span class="dot ${hasKey ? "ok" : ""}"></span>
          API-sleutel ${hasKey ? "(opgeslagen)" : "(vereist)"}
        </div>
        <span style="font-size:12px;color:#aaa">${hasKey ? "Wijzigen ▾" : "Instellen ▾"}</span>
      </div>
      <div class="api-key-section__body ${hasKey ? "hidden" : ""}" id="api-body">
        <input type="password" id="api-input" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" />
        <button class="btn-primary" id="api-save">Opslaan</button>
      </div>
      ${!hasKey ? `<p style="margin-top:8px;font-size:12px">Haal je sleutel op via <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener" style="color:#1a1a18">console.anthropic.com</a></p>` : ""}
    </div>

    <div class="upload-zone ${!hasKey ? "disabled" : ""}" id="upload-zone" role="button" tabindex="0" aria-label="Document uploaden">
      <input type="file" id="file-input" accept=".pdf,.txt,.md" multiple />
      <div class="upload-zone__icon"></div>
      <div class="upload-zone__title">Klik of sleep een document</div>
      <div class="upload-zone__sub">PDF, TXT of Markdown · meerdere bestanden tegelijk</div>
    </div>

    <div class="import-row">
      <input type="file" id="json-input" accept=".json" style="display:none" />
      <button class="btn" id="btn-import-json"><i data-lucide="upload"></i> Deck importeren via JSON</button>
    </div>

    ${state.decks.length > 0 ? `<div class="section-title">Mijn decks</div>` : ""}
    <div class="deck-list">${decksHtml}</div>
  `;
}

export function bindHomeEvents(
	render: () => void,
	startStudy: (id: string) => void,
): void {
	document.getElementById("btn-logout")?.addEventListener("click", async () => {
		await signOut();
		state.user = null;
		state.decks = [];
		render();
	});

	document.getElementById("api-toggle")?.addEventListener("click", () => {
		document.getElementById("api-body")?.classList.toggle("hidden");
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

	zone.addEventListener("click", () => {
		if (!state.apiKey) {
			showToast("Stel eerst een API-sleutel in", true);
			return;
		}
		fileInput.click();
	});
	zone.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			zone.click();
		}
	});
	zone.addEventListener("dragover", (e) => {
		e.preventDefault();
		zone.classList.add("drag-over");
	});
	zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		zone.classList.remove("drag-over");
		const files = Array.from(e.dataTransfer?.files ?? []);
		if (files.length) handleFiles(files, render);
	});
	fileInput.addEventListener("change", () => {
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
	jsonInput.addEventListener("change", async () => {
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
				cards: data.cards,
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

	document.querySelectorAll<HTMLElement>(".deck-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest("[data-delete]")) return;
			startStudy(card.dataset.id!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-delete]").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const id = btn.dataset.delete!;
			if (confirm("Deck verwijderen?")) {
				if (state.user) {
					await removeDeck(id);
					state.decks = state.decks.filter((d) => d.id !== id);
				} else {
					state.decks = deleteDeck(id, state.decks);
				}
				render();
			}
		});
	});
}

function isValidDeckJson(data: unknown): data is { name: string; cards: { question: string; answer: string }[] } {
	if (typeof data !== "object" || data === null) return false;
	const d = data as Record<string, unknown>;
	if (typeof d.name !== "string" || !d.name.trim()) return false;
	if (!Array.isArray(d.cards) || d.cards.length === 0) return false;
	return d.cards.every(
		(c) =>
			typeof c === "object" &&
			c !== null &&
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
