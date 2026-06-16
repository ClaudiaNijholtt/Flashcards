import { state } from "../state";
import { esc, formatDate, showToast } from "../utils/helpers";
import { saveApiKey, saveDecks, deleteDeck } from "../utils/storage";
import { signOut } from "../services/auth";
import { insertDeck, removeDeck, fetchDecks, fetchDeckPlayCounts, shareDeck, fetchDeckByShareCode } from "../services/decks";
import { generateFlashcards } from "../services/ai";
import { DECK_COLORS } from "../types";
import type { Deck } from "../types";

let _outsideClickHandler: ((e: Event) => void) | null = null;
let _escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function getDeckColorHex(colorKey: string | undefined): string {
	return DECK_COLORS.find((c) => c.key === colorKey)?.hex ?? "";
}

function filterDecks(): Deck[] {
	const q = state.deckSearch.toLowerCase();
	const tagF = state.deckTagFilter;
	return state.decks.filter((d) => {
		const matchSearch = !q || d.name.toLowerCase().includes(q);
		const matchTag = !tagF || (d.tags ?? []).includes(tagF);
		return matchSearch && matchTag;
	});
}

function deckMoreHtml(id: string): string {
	return `
    <div class="deck-more">
      <button class="btn-icon" data-more-btn="${id}" title="Meer opties" aria-label="Meer opties"><i data-lucide="ellipsis"></i></button>
      <div class="deck-more__menu hidden" id="more-menu-${id}">
        <button class="deck-more__item" data-stats="${id}"><i data-lucide="bar-chart-2"></i> Statistieken</button>
        <button class="deck-more__item" data-duel="${id}"><i data-lucide="swords"></i> Duel starten</button>
        <button class="deck-more__item" data-share="${id}"><i data-lucide="share-2"></i> Delen</button>
        <button class="deck-more__item" data-edit="${id}"><i data-lucide="pencil"></i> Bewerken</button>
        <button class="deck-more__item" data-export="${id}"><i data-lucide="download"></i> Exporteren</button>
        <button class="deck-more__item deck-more__item--danger" data-delete="${id}"><i data-lucide="trash-2"></i> Verwijderen</button>
      </div>
    </div>`;
}

function deckCardHtml(deck: Deck): string {
	const hex = getDeckColorHex(deck.color);
	const colorDot = hex ? `<span class="deck-color-dot" style="background:${hex}"></span>` : "";
	const iconStyle = hex ? ` style="color:${hex}"` : "";
	return `
    <div class="deck-card" data-id="${deck.id}">
      <div class="deck-card__icon" aria-hidden="true"${iconStyle}><i data-lucide="book-open"></i></div>
      <div class="deck-card__info">
        ${(deck.tags ?? []).length > 0 ? `<div class="deck-card__tags">${(deck.tags ?? []).map((name) => { const hex = state.userTags.find((t) => t.name === name)?.color ?? "#6b7280"; return `<span class="deck-tag-pill" style="--tag-color:${hex};--tag-bg:${hex}1a;">${esc(name)}</span>`; }).join("")}</div>` : ""}
        <div class="deck-card__name">${colorDot}${esc(deck.name)}</div>
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

	const visibleDecks = filterDecks();

	const hasTags = state.userTags.length > 0;
	// tagFilterHtml is now inlined inside decksHtml / deck-controls
	const tagFilterHtml = hasTags; // kept as truthy flag for decksHtml

	const searchHtml = `
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
      </div>`;

	const decksHtml = state.decks.length === 0
		? `<div class="home-empty">
        <i data-lucide="book-open"></i>
        <p>Je hebt nog geen decks. Upload een document hieronder om te beginnen.</p>
      </div>`
		: `<div class="section-title" style="margin-bottom:0.75rem">Mijn decks</div>
      <div class="deck-controls">
        ${tagFilterHtml
			? `<div class="tag-filter" id="tag-filter">
            <button class="tag-chip ${!state.deckTagFilter ? "tag-chip--active" : ""}" data-tag-filter="">Alle</button>
            ${state.userTags.map((tag) => `<button class="tag-chip tag-chip--colored ${state.deckTagFilter === tag.name ? "tag-chip--active" : ""}" data-tag-filter="${esc(tag.name)}" style="--tag-color:${tag.color};--tag-color-bg:${tag.color}1a;">${esc(tag.name)}</button>`).join("")}
          </div>`
			: `<div></div>`}
        ${searchHtml}
      </div>
      <div class="deck-list" id="deck-list">
        ${visibleDecks.length > 0
			? visibleDecks.map(deckCardHtml).join("")
			: `<div class="home-empty"><p>Geen decks gevonden${state.deckTagFilter ? ` voor tag "<strong>${esc(state.deckTagFilter)}</strong>"` : state.deckSearch ? ` voor "<strong>${esc(state.deckSearch)}</strong>"` : ""}.</p></div>`}
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

    <div class="home-layout">
      <aside class="home-side">
        <div class="home-hero">
          <h1>Welkom terug${firstName ? `, ${esc(firstName)}` : ""}!</h1>
          ${statsHtml}
        </div>

        ${apiBannerHtml}

        <div class="add-section">
          <button class="btn-primary btn-add-deck-trigger" id="btn-open-add-modal">
            <i data-lucide="plus"></i> Deck toevoegen
          </button>
        </div>

        ${apiSettingsHtml}
      </aside>

      <main class="home-main">
        ${decksHtml}
      </main>
    </div>

    <button class="fab" id="fab-add-deck" title="Deck toevoegen" aria-label="Deck toevoegen">
      <i data-lucide="plus"></i>
    </button>

    <div class="modal-overlay hidden" id="add-deck-modal" role="dialog" aria-modal="true" aria-labelledby="add-deck-modal-title">
      <div class="modal-glass">
        <div class="modal-glass__header">
          <span class="modal-glass__title" id="add-deck-modal-title">Deck toevoegen</span>
          <button class="btn-icon modal-glass__close" id="modal-close" title="Sluiten" aria-label="Sluiten">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-glass__body">
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
            <button class="btn" id="btn-share-import-toggle"><i data-lucide="share-2"></i> Deck overnemen</button>
          </div>
          <div class="duel-join-panel hidden" id="duel-join-panel">
            <div class="duel-join-form">
              <input type="text" id="duel-code-home" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters" />
              <button class="btn-primary" id="btn-home-join-duel">Meedoen <i data-lucide="arrow-right"></i></button>
            </div>
            <p id="duel-home-error" class="duel-lobby__error hidden"></p>
          </div>
          <div class="duel-join-panel hidden" id="share-import-panel">
            <div class="duel-join-form">
              <input type="text" id="share-code-input" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters" />
              <button class="btn-primary" id="btn-import-by-code">Overnemen <i data-lucide="arrow-right"></i></button>
            </div>
            <p id="share-import-error" class="duel-lobby__error hidden"></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openAddDeckModal(): void {
	document.getElementById("add-deck-modal")?.classList.remove("hidden");
	document.body.style.overflow = "hidden";
}

function closeAddDeckModal(): void {
	document.getElementById("add-deck-modal")?.classList.add("hidden");
	document.body.style.overflow = "";
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

	// Tag filter chips
	document.getElementById("tag-filter")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-tag-filter]");
		if (!btn || !("tagFilter" in btn.dataset)) return;
		state.deckTagFilter = btn.dataset.tagFilter ?? "";
		render();
	});

	const searchInput = document.getElementById("deck-search") as HTMLInputElement | null;
	searchInput?.addEventListener("input", () => {
		state.deckSearch = searchInput.value;
		const list = document.getElementById("deck-list");
		if (!list) return;
		const visible = filterDecks();
		list.innerHTML = visible.length > 0
			? visible.map(deckCardHtml).join("")
			: `<div class="home-empty"><p>Geen decks gevonden${state.deckTagFilter ? ` voor tag "<strong>${esc(state.deckTagFilter)}</strong>"` : state.deckSearch ? ` voor "<strong>${esc(state.deckSearch)}</strong>"` : ""}.</p></div>`;
		import("lucide").then(({ createIcons, BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis, Flame, User, Share2 }) =>
			createIcons({ icons: { BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis, Flame, User, Share2 } }));
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
		document.querySelectorAll<HTMLElement>("[data-share]").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.stopPropagation();
				try {
					const code = await shareDeck(btn.dataset.share!);
					try { await navigator.clipboard.writeText(code); showToast(`Deelcode gekopieerd: ${code}`); }
					catch { showToast(`Deelcode: ${code} (kopieer handmatig)`); }
				} catch (err) {
					showToast(err instanceof Error ? err.message : "Delen mislukt", true);
				}
			});
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

	// ── Add deck modal ────────────────────────────────────────────────────────

	// Reset scroll lock from any previous modal open
	document.body.style.overflow = "";

	document.getElementById("btn-open-add-modal")?.addEventListener("click", openAddDeckModal);
	document.getElementById("fab-add-deck")?.addEventListener("click", openAddDeckModal);
	document.getElementById("modal-close")?.addEventListener("click", closeAddDeckModal);
	document.getElementById("add-deck-modal")?.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).id === "add-deck-modal") closeAddDeckModal();
	});

	if (_escapeKeyHandler) document.removeEventListener("keydown", _escapeKeyHandler);
	_escapeKeyHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape" && !document.getElementById("add-deck-modal")?.classList.contains("hidden")) {
			closeAddDeckModal();
		}
	};
	document.addEventListener("keydown", _escapeKeyHandler);

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
				tags: [],
				color: "",
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

	// Deck card events for initial render
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

	document.querySelectorAll<HTMLElement>("[data-due]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startDueStudy(btn.dataset.due!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-share]").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			e.stopPropagation();
			try {
				const code = await shareDeck(btn.dataset.share!);
				try { await navigator.clipboard.writeText(code); showToast(`Deelcode gekopieerd: ${code}`); }
				catch { showToast(`Deelcode: ${code} (kopieer handmatig)`); }
			} catch (err) {
				showToast(err instanceof Error ? err.message : "Delen mislukt", true);
			}
		});
	});

	document.querySelectorAll<HTMLElement>("[data-edit]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			editDeck(btn.dataset.edit!);
		});
	});

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

	document.querySelectorAll<HTMLElement>("[data-stats]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startStats(btn.dataset.stats!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-duel]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			startDuel(btn.dataset.duel!);
		});
	});

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

	// Share import: toggle panel
	document.getElementById("btn-share-import-toggle")?.addEventListener("click", () => {
		const panel = document.getElementById("share-import-panel");
		document.getElementById("duel-join-panel")?.classList.add("hidden");
		panel?.classList.toggle("hidden");
		if (!panel?.classList.contains("hidden")) (document.getElementById("share-code-input") as HTMLInputElement)?.focus();
	});

	// Share import: submit
	const shareCodeInput = document.getElementById("share-code-input") as HTMLInputElement | null;
	shareCodeInput?.addEventListener("input", () => { shareCodeInput.value = shareCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
	shareCodeInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-import-by-code")?.click(); });
	document.getElementById("btn-import-by-code")?.addEventListener("click", async () => {
		const code = shareCodeInput?.value.trim() ?? "";
		const errEl = document.getElementById("share-import-error");
		if (code.length !== 6) { if (errEl) { errEl.textContent = "Voer een geldige 6-teken deelcode in"; errEl.classList.remove("hidden"); } return; }
		errEl?.classList.add("hidden");
		try {
			const { name, cards, creatorUsername } = await fetchDeckByShareCode(code);
			const deck: Deck = {
				id: Date.now().toString(),
				name,
				cards: cards.map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() })),
				createdAt: new Date(),
				creatorUsername,
				tags: [],
				color: "",
			};
			if (state.user) {
				await insertDeck(deck);
				state.decks = await fetchDecks();
				state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
			} else {
				state.decks.push(deck);
				saveDecks(state.decks);
			}
			showToast(`"${deck.name}" overgenomen ✓`);
			render();
		} catch (err) {
			if (errEl) { errEl.textContent = err instanceof Error ? err.message : "Overnemen mislukt"; errEl.classList.remove("hidden"); }
		}
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
				creatorUsername: state.user?.username ?? undefined,
				tags: [],
				color: "",
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
