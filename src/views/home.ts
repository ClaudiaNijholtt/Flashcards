import { state } from "../state";
import { esc, formatDate, showToast } from "../utils/helpers";
import { saveApiKey, saveDecks, deleteDeck } from "../utils/storage";
import { signOut } from "../services/auth";
import { insertDeck, removeDeck, fetchDecks, fetchDeckPlayCounts } from "../services/decks";
import { generateFlashcards } from "../services/ai";
import type { Deck } from "../types";

let _outsideClickHandler: ((e: Event) => void) | null = null;

function deckMoreHtml(id: string): string {
	return `
    <div class="deck-more">
      <button class="btn-icon" data-more-btn="${id}" title="Meer opties" aria-label="Meer opties"><i data-lucide="ellipsis"></i></button>
      <div class="deck-more__menu hidden" id="more-menu-${id}">
        <button class="deck-more__item" data-stats="${id}"><i data-lucide="bar-chart-2"></i> Statistieken</button>
        <button class="deck-more__item" data-duel="${id}"><i data-lucide="swords"></i> Duel starten</button>
        <button class="deck-more__item" data-edit="${id}"><i data-lucide="pencil"></i> Bewerken</button>
        <button class="deck-more__item" data-export="${id}"><i data-lucide="download"></i> Exporteren</button>
        <button class="deck-more__item deck-more__item--danger" data-delete="${id}"><i data-lucide="trash-2"></i> Verwijderen</button>
      </div>
    </div>`;
}

export function renderHome(): string {
	const hasKey = !!state.apiKey;
	const totalCards = state.decks.reduce((sum, d) => sum + d.cards.length, 0);
	const firstName = state.user?.username ?? state.user?.email?.split("@")[0] ?? "";

	const streakHtml = state.streak > 0
		? `<div class="streak-badge"><i data-lucide="flame"></i> ${state.streak} dag${state.streak !== 1 ? "en" : ""} op rij</div>`
		: "";

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
        ${streakHtml}
      </div>`
		: streakHtml ? `<div class="home-stats">${streakHtml}</div>` : "";

	const q = state.deckSearch.toLowerCase();
	const visibleDecks = q
		? state.decks.filter((d) => d.name.toLowerCase().includes(q))
		: state.decks;

	const deckListHtml = (decks: typeof state.decks) => decks.map((deck) => `
          <div class="deck-card" data-id="${deck.id}">
            <div class="deck-card__icon" aria-hidden="true"><i data-lucide="book-open"></i></div>
            <div class="deck-card__info">
              <div class="deck-card__name">${esc(deck.name)}</div>
              <div class="deck-card__meta">
                ${deck.cards.length} kaarten &nbsp;·&nbsp; ${formatDate(deck.createdAt)}
                ${deck.creatorUsername ? `&nbsp;·&nbsp; <span class="deck-card__creator"><i data-lucide="user" style="width:11px;height:11px;vertical-align:-1px"></i> ${esc(deck.creatorUsername)}</span>` : ""}
                ${(state.deckPlayCounts[deck.id] ?? 0) > 0 ? `&nbsp;·&nbsp; <span class="deck-card__plays"><i data-lucide="swords" style="width:11px;height:11px;vertical-align:-1px"></i> ${state.deckPlayCounts[deck.id]} keer geduelleerd</span>` : ""}
              </div>
            </div>
            <div class="deck-card__actions">
              <div class="deck-card__primary">
                ${(state.deckDueCounts[deck.id] ?? 0) > 0 ? `<button class="btn deck-card__due" data-due="${deck.id}" title="${state.deckDueCounts[deck.id]} kaarten te leren vandaag"><i data-lucide="flame"></i> ${state.deckDueCounts[deck.id]}</button>` : ""}
                <button class="btn-primary deck-card__study" data-study="${deck.id}">Leren <i data-lucide="arrow-right"></i></button>
              </div>
              ${deckMoreHtml(deck.id)}
            </div>
          </div>`).join("");

	const decksHtml = state.decks.length === 0
		? `<div class="home-empty">
        <i data-lucide="book-open"></i>
        <p>Je hebt nog geen decks. Upload een document hieronder om te beginnen.</p>
      </div>`
		: `<div class="section-header">
        <div class="section-title">Mijn decks</div>
        <div class="deck-search-wrap">
          <i data-lucide="search" class="deck-search__icon"></i>
          <input
            type="search"
            id="deck-search"
            class="deck-search"
            placeholder="Zoeken…"
            value="${esc(state.deckSearch)}"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="deck-list" id="deck-list">
        ${visibleDecks.length > 0
			? deckListHtml(visibleDecks)
			: `<div class="home-empty"><p>Geen decks gevonden voor "<strong>${esc(state.deckSearch)}</strong>".</p></div>`}
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

	const isDark = document.documentElement.getAttribute("data-theme") === "dark";

	return `
    <div class="topbar">
      <span class="topbar__brand">Flashcards</span>
      <div class="topbar__user">
        <button class="btn-icon" id="btn-theme" title="${isDark ? "Licht thema" : "Donker thema"}" aria-label="Thema wisselen">
          <i data-lucide="${isDark ? "sun" : "moon"}"></i>
        </button>
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
	editDeck: (id: string) => void,
	startDueStudy: (id: string) => void,
): void {
	document.getElementById("btn-theme")?.addEventListener("click", () => {
		const isDark = document.documentElement.getAttribute("data-theme") === "dark";
		if (isDark) {
			document.documentElement.removeAttribute("data-theme");
			localStorage.setItem("theme", "light");
		} else {
			document.documentElement.setAttribute("data-theme", "dark");
			localStorage.setItem("theme", "dark");
		}
		render();
	});

	document.getElementById("btn-profile")?.addEventListener("click", goToProfile);

	const searchInput = document.getElementById("deck-search") as HTMLInputElement | null;
	searchInput?.addEventListener("input", () => {
		state.deckSearch = searchInput.value;
		const list = document.getElementById("deck-list");
		if (!list) return;
		const q = state.deckSearch.toLowerCase();
		const visible = q ? state.decks.filter((d) => d.name.toLowerCase().includes(q)) : state.decks;
		list.innerHTML = visible.length > 0
			? visible.map((deck) => `
          <div class="deck-card" data-id="${deck.id}">
            <div class="deck-card__icon"><i data-lucide="book-open"></i></div>
            <div class="deck-card__info">
              <div class="deck-card__name">${esc(deck.name)}</div>
              <div class="deck-card__meta">${deck.cards.length} kaarten &nbsp;·&nbsp; ${formatDate(deck.createdAt)}</div>
            </div>
            <div class="deck-card__actions">
              <div class="deck-card__primary">
                <button class="btn-primary deck-card__study" data-study="${deck.id}">Leren <i data-lucide="arrow-right"></i></button>
              </div>
              ${deckMoreHtml(deck.id)}
            </div>
          </div>`).join("")
			: `<div class="home-empty"><p>Geen decks gevonden voor "<strong>${esc(state.deckSearch)}</strong>".</p></div>`;
		import("lucide").then(({ createIcons, BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis }) =>
			createIcons({ icons: { BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis } }));
		bindDeckCardEvents();
	});

	function bindDeckCardEvents(): void {
		document.querySelectorAll<HTMLElement>(".deck-card").forEach((card) => {
			card.addEventListener("click", (e) => {
				const t = e.target as HTMLElement;
				if (t.closest("[data-delete]") || t.closest("[data-duel]") || t.closest("[data-export]") || t.closest("[data-study]") || t.closest("[data-stats]") || t.closest("[data-edit]") || t.closest("[data-due]") || t.closest(".deck-more")) return;
				startStudy(card.dataset.id!);
			});
		});
		document.querySelectorAll<HTMLElement>("[data-study]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); startStudy(btn.dataset.study!); });
		});
		document.querySelectorAll<HTMLElement>("[data-due]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); startDueStudy(btn.dataset.due!); });
		});
		document.querySelectorAll<HTMLElement>("[data-stats]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); startStats(btn.dataset.stats!); });
		});
		document.querySelectorAll<HTMLElement>("[data-duel]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); startDuel(btn.dataset.duel!); });
		});
		document.querySelectorAll<HTMLElement>("[data-edit]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); editDeck(btn.dataset.edit!); });
		});
		document.querySelectorAll<HTMLElement>("[data-export]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const deck = state.decks.find((d) => d.id === btn.dataset.export);
				if (!deck) return;
				const blob = new Blob([JSON.stringify({ name: deck.name, cards: deck.cards }, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url; a.download = `${deck.name.replace(/[^a-z0-9]/gi, "_")}.json`; a.click();
				URL.revokeObjectURL(url);
			});
		});
		document.querySelectorAll<HTMLElement>("[data-delete]").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.stopPropagation();
				const id = btn.dataset.delete!;
				if (!confirm("Deck verwijderen?")) return;
				try {
					if (state.user) { await removeDeck(id); state.decks = state.decks.filter((d) => d.id !== id); }
					else { state.decks = deleteDeck(id, state.decks); }
					render();
				} catch (err) {
					showToast(err instanceof Error ? err.message : "Verwijderen mislukt", true);
				}
			});
		});
		bindMoreButtons();
	}

	function bindMoreButtons(): void {
		document.querySelectorAll<HTMLElement>("[data-more-btn]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const menu = document.getElementById(`more-menu-${btn.dataset.moreBtn}`);
				const isOpen = menu && !menu.classList.contains("hidden");
				document.querySelectorAll<HTMLElement>(".deck-more__menu").forEach((m) => m.classList.add("hidden"));
				if (!isOpen && menu) menu.classList.remove("hidden");
			});
		});
		document.querySelectorAll<HTMLElement>(".deck-more__item").forEach((item) => {
			item.addEventListener("click", () => item.closest<HTMLElement>(".deck-more__menu")?.classList.add("hidden"));
		});
	}

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
				creatorUsername: state.user?.username ?? undefined,
			};
			if (state.user) {
				await insertDeck(deck);
				state.decks = await fetchDecks();
				state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
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
			if (t.closest("[data-delete]") || t.closest("[data-duel]") || t.closest("[data-export]") || t.closest("[data-study]") || t.closest("[data-stats]") || t.closest("[data-edit]") || t.closest(".deck-more")) return;
			startStudy(card.dataset.id!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-study]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startStudy(btn.dataset.study!);
		});
	});

	// Edit deck
	document.querySelectorAll<HTMLElement>("[data-edit]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			editDeck(btn.dataset.edit!);
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

	// More menu: initial render binding
	bindMoreButtons();

	// Outside click closes all open menus (capture so it fires before item handlers)
	if (_outsideClickHandler) document.removeEventListener("click", _outsideClickHandler, { capture: true });
	_outsideClickHandler = (e: Event) => {
		const t = e.target as HTMLElement;
		if (t.closest(".deck-more__menu") || t.closest("[data-more-btn]")) return;
		document.querySelectorAll<HTMLElement>(".deck-more__menu").forEach((m) => m.classList.add("hidden"));
	};
	document.addEventListener("click", _outsideClickHandler, { capture: true });

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
				creatorUsername: state.user?.username ?? undefined,
			};

			state.decks.push(deck);
			if (state.user) {
				await insertDeck(deck);
				state.decks = await fetchDecks();
				state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
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
