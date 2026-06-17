import { state } from "../state";
import { esc, formatDate, showToast, shuffle } from "../utils/helpers";
import { saveDecks, deleteDeck } from "../utils/storage";
import { signOut } from "../services/auth";
import { insertDeck, removeDeck, fetchDecks, fetchDeckPlayCounts, shareDeck, fetchDeckByShareCode, setDeckPublic } from "../services/decks";
import { generateFlashcards } from "../services/ai";
import { DECK_COLORS } from "../types";
import type { Deck } from "../types";

let _outsideClickHandler: ((e: Event) => void) | null = null;
let _escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let _splitDeckId: string | null = null;
let _mergeDeckId: string | null = null;

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

function deckMoreHtml(deck: Deck): string {
	const id = deck.id;
	const canUnmerge = (deck.mergedFrom?.length ?? 0) > 0;
	return `
    <div class="deck-more">
      <button class="btn-icon" data-more-btn="${id}" title="Meer opties" aria-label="Meer opties"><i data-lucide="ellipsis"></i></button>
      <div class="deck-more__menu hidden" id="more-menu-${id}">
        <button class="deck-more__item" data-stats="${id}"><i data-lucide="bar-chart-2"></i> Statistieken</button>
        <button class="deck-more__item" data-split="${id}"><i data-lucide="scissors"></i> Splitsen</button>
        <button class="deck-more__item" data-merge="${id}"><i data-lucide="git-merge"></i> Samenvoegen</button>
        ${canUnmerge ? `<button class="deck-more__item" data-unmerge="${id}"><i data-lucide="unlink"></i> Loskoppelen</button>` : ""}
        <button class="deck-more__item" data-share="${id}"><i data-lucide="share-2"></i> Delen</button>
        <button class="deck-more__item" data-toggle-public="${id}" data-is-public="${deck.isPublic ? '1' : '0'}">
          <i data-lucide="${deck.isPublic ? 'eye-off' : 'eye'}"></i>
          ${deck.isPublic ? 'Privé maken' : 'Publiek maken'}
        </button>
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
          ${deck.cards.length} kaarten &nbsp;&middot;&nbsp; ${formatDate(deck.createdAt)}
          ${deck.creatorUsername ? `&nbsp;&middot;&nbsp; <span class="deck-card__creator"><i data-lucide="user" style="width:11px;height:11px;vertical-align:-1px"></i> ${esc(deck.creatorUsername)}</span>` : ""}
          ${(state.deckPlayCounts[deck.id] ?? 0) > 0 ? `&nbsp;&middot;&nbsp; <span class="deck-card__plays"><i data-lucide="swords" style="width:11px;height:11px;vertical-align:-1px"></i> ${state.deckPlayCounts[deck.id]} keer geduelleerd</span>` : ""}
        </div>
      </div>
      <div class="deck-card__actions">
        <div class="deck-card__primary">
          ${(state.deckDueCounts[deck.id] ?? 0) > 0 ? `<button class="btn deck-card__due" data-due="${deck.id}" title="${state.deckDueCounts[deck.id]} kaarten te leren vandaag"><i data-lucide="flame"></i> ${state.deckDueCounts[deck.id]}</button>` : ""}
          <button class="btn-primary deck-card__study" data-study="${deck.id}">Leren <i data-lucide="arrow-right"></i></button>
        </div>
        ${deckMoreHtml(deck)}
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
        <span class="home-stat__sep">&middot;</span>
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
          placeholder="Zoeken&hellip;"
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

        <div class="join-game-section">
          <div class="join-game-section__label">Meedoen aan een spel</div>
          <div class="join-game-section__form">
            <input type="text" id="duel-code-home" class="join-game-section__input" placeholder="Spelcode&hellip;" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" />
            <button class="btn-primary" id="btn-home-join-duel" title="Meedoen">
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
          <p id="duel-home-error" class="duel-lobby__error hidden"></p>
        </div>

        <div class="add-section">
          <button class="btn" id="btn-discover" style="width:100%;justify-content:center;margin-bottom:0.5rem">
            <i data-lucide="compass"></i> Ontdekken
          </button>
          <button class="btn" id="btn-open-mix-modal" style="width:100%;justify-content:center;margin-bottom:0.5rem">
            <i data-lucide="shuffle"></i> Decks mixen
          </button>
          <button class="btn-primary btn-add-deck-trigger" id="btn-open-add-modal">
            <i data-lucide="plus"></i> Deck toevoegen
          </button>
        </div>
      </aside>

      <main class="home-main">
        ${decksHtml}
      </main>
    </div>

    <button class="fab" id="fab-add-deck" title="Deck toevoegen" aria-label="Deck toevoegen">
      <i data-lucide="plus"></i>
    </button>

    <div class="modal-overlay hidden" id="split-deck-modal" role="dialog" aria-modal="true" aria-labelledby="split-modal-title">
      <div class="modal-glass" style="max-width:380px">
        <div class="modal-glass__header">
          <span class="modal-glass__title" id="split-modal-title">Deck splitsen</span>
          <button class="btn-icon modal-glass__close" id="split-modal-close" title="Sluiten" aria-label="Sluiten"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-glass__body">
          <p id="split-deck-info" class="profile-hint" style="margin-bottom:1.25rem"></p>
          <label for="split-parts-input" style="display:block;font-size:14px;font-weight:600;margin-bottom:0.5rem">Aantal delen</label>
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem">
            <input type="number" id="split-parts-input" min="2" max="20" value="2"
              style="width:72px;padding:0.5rem;border:1.5px solid var(--border-mid);border-radius:8px;font-size:16px;background:var(--surface-alt);color:var(--text);text-align:center" />
            <span id="split-preview" style="font-size:13px;color:var(--text-muted)"></span>
          </div>
          <button class="btn-primary" id="btn-confirm-split" style="width:100%;justify-content:center">
            Splitsen <i data-lucide="scissors"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="mix-deck-modal" role="dialog" aria-modal="true" aria-labelledby="mix-modal-title">
      <div class="modal-glass" style="max-width:480px">
        <div class="modal-glass__header">
          <span class="modal-glass__title" id="mix-modal-title">Decks mixen</span>
          <button class="btn-icon modal-glass__close" id="mix-modal-close" title="Sluiten" aria-label="Sluiten"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-glass__body">
          ${state.userTags.length > 0 ? `
          <div class="mix-tag-row" id="mix-tag-row">
            ${state.userTags.map((t) => `<button class="tag-chip tag-chip--colored" data-mix-tag="${esc(t.name)}" style="--tag-color:${t.color};--tag-color-bg:${t.color}1a;">${esc(t.name)}</button>`).join("")}
          </div>` : ""}
          <div class="merge-search-wrap">
            <i data-lucide="search" class="merge-search__icon"></i>
            <input type="search" id="mix-search" placeholder="Zoeken&hellip;" autocomplete="off" />
          </div>
          <div id="mix-deck-list" class="merge-deck-list"></div>
          <p id="mix-preview" style="font-size:13px;color:var(--text-muted);margin-top:0.75rem;margin-bottom:1.1rem"></p>
          <button class="btn-primary" id="btn-confirm-mix" style="width:100%;justify-content:center">
            Starten <i data-lucide="arrow-right"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="merge-deck-modal" role="dialog" aria-modal="true" aria-labelledby="merge-modal-title">
      <div class="modal-glass" style="max-width:480px">
        <div class="modal-glass__header">
          <span class="modal-glass__title" id="merge-modal-title">Decks samenvoegen</span>
          <button class="btn-icon modal-glass__close" id="merge-modal-close" title="Sluiten" aria-label="Sluiten"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-glass__body">
          <label for="merge-name-input" style="display:block;font-size:14px;font-weight:600;margin-bottom:0.4rem">Naam van het samengevoegde deck</label>
          <input type="text" id="merge-name-input" maxlength="80" autocomplete="off"
            style="width:100%;padding:0.55rem 0.75rem;border:1.5px solid var(--border-mid);border-radius:8px;font-size:14px;background:var(--surface-alt);color:var(--text);margin-bottom:1.25rem;box-sizing:border-box" />
          <label style="display:block;font-size:14px;font-weight:600;margin-bottom:0.5rem">Selecteer decks om samen te voegen</label>
          <div class="merge-search-wrap">
            <i data-lucide="search" class="merge-search__icon"></i>
            <input type="search" id="merge-search" placeholder="Zoeken&hellip;" autocomplete="off" />
          </div>
          <div id="merge-deck-list" class="merge-deck-list"></div>
          <p id="merge-preview" style="font-size:13px;color:var(--text-muted);margin-top:0.75rem;margin-bottom:1.1rem"></p>
          <button class="btn-primary" id="btn-confirm-merge" style="width:100%;justify-content:center">
            Samenvoegen <i data-lucide="git-merge"></i>
          </button>
        </div>
      </div>
    </div>

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
            <button class="btn" id="btn-share-import-toggle"><i data-lucide="share-2"></i> Deck overnemen</button>
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

function openSplitModal(deckId: string): void {
	_splitDeckId = deckId;
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck) return;
	const info = document.getElementById("split-deck-info");
	const input = document.getElementById("split-parts-input") as HTMLInputElement;
	const max = Math.min(deck.cards.length, 20);
	if (info) info.textContent = `"${deck.name}" heeft ${deck.cards.length} kaarten. Kies in hoeveel gelijke delen je het wilt splitsen.`;
	if (input) { input.max = String(max); input.value = "2"; }
	updateSplitPreview(deck.cards.length, 2);
	document.getElementById("split-deck-modal")?.classList.remove("hidden");
	document.body.style.overflow = "hidden";
}

function closeSplitModal(): void {
	document.getElementById("split-deck-modal")?.classList.add("hidden");
	document.body.style.overflow = "";
	_splitDeckId = null;
}

function mergeDeckCardHtml(deck: Deck): string {
	const hex = getDeckColorHex(deck.color);
	const colorDot = hex ? `<span class="deck-color-dot" style="background:${hex}"></span>` : "";
	const iconStyle = hex ? ` style="color:${hex}"` : "";
	const tagsHtml = (deck.tags ?? []).length > 0
		? `<div class="deck-card__tags" style="margin-bottom:3px">${(deck.tags ?? []).map((name) => {
			const tagHex = state.userTags.find((t) => t.name === name)?.color ?? "#6b7280";
			return `<span class="deck-tag-pill" style="--tag-color:${tagHex};--tag-bg:${tagHex}1a;">${esc(name)}</span>`;
		}).join("")}</div>` : "";
	return `
    <div class="merge-deck-card" data-merge-id="${deck.id}">
      <div class="merge-deck-card__icon"${iconStyle}><i data-lucide="book-open"></i></div>
      <div class="merge-deck-card__info">
        ${tagsHtml}
        <div class="merge-deck-card__name">${colorDot}${esc(deck.name)}</div>
        <div class="merge-deck-card__meta">${deck.cards.length} kaarten &middot; ${formatDate(deck.createdAt)}</div>
      </div>
      <div class="merge-deck-card__check"><i data-lucide="check"></i></div>
    </div>`;
}

function renderMergeDeckList(baseDeckId: string, query: string): void {
	const listEl = document.getElementById("merge-deck-list");
	if (!listEl) return;
	const q = query.toLowerCase();
	const others = state.decks.filter((d) => d.id !== baseDeckId && (!q || d.name.toLowerCase().includes(q)));
	const selectedIds = new Set(
		Array.from(document.querySelectorAll<HTMLElement>(".merge-deck-card--selected")).map((el) => el.dataset.mergeId!),
	);
	if (others.length === 0) {
		listEl.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:0.5rem 0">${q ? "Geen decks gevonden." : "Geen andere decks beschikbaar."}</p>`;
		return;
	}
	listEl.innerHTML = others.map((d) => mergeDeckCardHtml(d)).join("");
	listEl.querySelectorAll<HTMLElement>(".merge-deck-card").forEach((card) => {
		if (selectedIds.has(card.dataset.mergeId!)) card.classList.add("merge-deck-card--selected");
		card.addEventListener("click", () => {
			card.classList.toggle("merge-deck-card--selected");
			updateMergePreview(baseDeckId);
		});
	});
	import("lucide").then(({ createIcons, BookOpen, Check }) => createIcons({ icons: { BookOpen, Check } }));
}

function openMergeModal(deckId: string): void {
	_mergeDeckId = deckId;
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck) return;
	const nameInput = document.getElementById("merge-name-input") as HTMLInputElement | null;
	if (nameInput) nameInput.value = deck.name;
	const searchInput = document.getElementById("merge-search") as HTMLInputElement | null;
	if (searchInput) searchInput.value = "";
	renderMergeDeckList(deckId, "");
	updateMergePreview(deckId);
	document.getElementById("merge-deck-modal")?.classList.remove("hidden");
	document.body.style.overflow = "hidden";
}

function closeMergeModal(): void {
	document.getElementById("merge-deck-modal")?.classList.add("hidden");
	document.body.style.overflow = "";
	_mergeDeckId = null;
}

function updateMergePreview(baseDeckId: string): void {
	const preview = document.getElementById("merge-preview");
	if (!preview) return;
	const base = state.decks.find((d) => d.id === baseDeckId);
	if (!base) return;
	const selectedCards = Array.from(document.querySelectorAll<HTMLElement>(".merge-deck-card--selected"))
		.map((el) => state.decks.find((d) => d.id === el.dataset.mergeId))
		.filter(Boolean) as typeof state.decks;
	const total = base.cards.length + selectedCards.reduce((s, d) => s + d.cards.length, 0);
	if (selectedCards.length === 0) {
		preview.textContent = "Selecteer minimaal één deck om samen te voegen.";
	} else {
		preview.textContent = `Resultaat: ${total} kaarten (${base.cards.length} + ${selectedCards.map((d) => d.cards.length).join(" + ")})`;
	}
}

function openMixModal(): void {
	const searchInput = document.getElementById("mix-search") as HTMLInputElement | null;
	if (searchInput) searchInput.value = "";
	renderMixDeckList("");
	updateMixPreview();
	document.getElementById("mix-deck-modal")?.classList.remove("hidden");
	document.body.style.overflow = "hidden";
}

function closeMixModal(): void {
	document.getElementById("mix-deck-modal")?.classList.add("hidden");
	document.body.style.overflow = "";
}

function renderMixDeckList(query: string): void {
	const listEl = document.getElementById("mix-deck-list");
	if (!listEl) return;
	const q = query.toLowerCase();
	const decks = state.decks.filter((d) => !q || d.name.toLowerCase().includes(q));
	const selectedIds = new Set(
		Array.from(document.querySelectorAll<HTMLElement>(".mix-deck-card--selected")).map((el) => el.dataset.mixId!),
	);
	if (decks.length === 0) {
		listEl.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:0.5rem 0">Geen decks gevonden.</p>`;
		return;
	}
	listEl.innerHTML = decks.map((d) => {
		const hex = getDeckColorHex(d.color);
		const colorDot = hex ? `<span class="deck-color-dot" style="background:${hex}"></span>` : "";
		const iconStyle = hex ? ` style="color:${hex}"` : "";
		const tagsHtml = (d.tags ?? []).length > 0
			? `<div class="deck-card__tags" style="margin-bottom:3px">${(d.tags ?? []).map((name) => {
				const tagHex = state.userTags.find((t) => t.name === name)?.color ?? "#6b7280";
				return `<span class="deck-tag-pill" style="--tag-color:${tagHex};--tag-bg:${tagHex}1a;">${esc(name)}</span>`;
			}).join("")}</div>` : "";
		return `
      <div class="merge-deck-card${selectedIds.has(d.id) ? " merge-deck-card--selected mix-deck-card--selected" : ""}" data-mix-id="${d.id}">
        <div class="merge-deck-card__icon"${iconStyle}><i data-lucide="book-open"></i></div>
        <div class="merge-deck-card__info">
          ${tagsHtml}
          <div class="merge-deck-card__name">${colorDot}${esc(d.name)}</div>
          <div class="merge-deck-card__meta">${d.cards.length} kaarten &middot; ${formatDate(d.createdAt)}</div>
        </div>
        <div class="merge-deck-card__check"><i data-lucide="check"></i></div>
      </div>`;
	}).join("");
	listEl.querySelectorAll<HTMLElement>("[data-mix-id]").forEach((card) => {
		card.addEventListener("click", () => {
			card.classList.toggle("merge-deck-card--selected");
			card.classList.toggle("mix-deck-card--selected");
			updateMixPreview();
		});
	});
	import("lucide").then(({ createIcons, BookOpen, Check }) => createIcons({ icons: { BookOpen, Check } }));
}

function updateMixPreview(): void {
	const preview = document.getElementById("mix-preview");
	if (!preview) return;
	const selected = Array.from(document.querySelectorAll<HTMLElement>(".mix-deck-card--selected"))
		.map((el) => state.decks.find((d) => d.id === el.dataset.mixId))
		.filter(Boolean) as typeof state.decks;
	const total = selected.reduce((s, d) => s + d.cards.length, 0);
	if (selected.length === 0) {
		preview.textContent = "Selecteer minimaal één deck.";
	} else {
		preview.textContent = `${selected.length} deck${selected.length !== 1 ? "s" : ""} geselecteerd · ${total} kaarten`;
	}
}

function updateSplitPreview(total: number, parts: number): void {
	const preview = document.getElementById("split-preview");
	if (!preview) return;
	if (parts < 2 || parts > total) { preview.textContent = ""; return; }
	const base = Math.floor(total / parts);
	const remainder = total % parts;
	const counts = Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
	preview.textContent = counts.join(" + ") + " kaarten";
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
	startQuiz: (deckId: string) => void,
	startMatch: (deckId: string) => void,
	goToDiscover: () => void,
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

	document.getElementById("btn-discover")?.addEventListener("click", goToDiscover);

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
		import("lucide").then(({ createIcons, BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis, Flame, User, Share2, Scissors, GitMerge, Unlink, Shuffle }) =>
			createIcons({ icons: { BookOpen, ArrowRight, BarChart2, Swords, Download, Trash2, Pencil, Ellipsis, Flame, User, Share2, Scissors, GitMerge, Unlink, Shuffle } }));
		bindDeckCardEvents();
	});

	function bindDeckCardEvents(): void {
		document.querySelectorAll<HTMLElement>(".deck-card").forEach((card) => {
			card.addEventListener("click", (e) => {
				const t = e.target as HTMLElement;
				if (t.closest("[data-delete]") || t.closest("[data-split]") || t.closest("[data-merge]") || t.closest("[data-unmerge]") || t.closest("[data-export]") || t.closest("[data-study]") || t.closest("[data-stats]") || t.closest("[data-edit]") || t.closest("[data-due]") || t.closest("[data-toggle-public]") || t.closest(".deck-more")) return;
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
		document.querySelectorAll<HTMLElement>("[data-split]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); openSplitModal(btn.dataset.split!); });
		});
		document.querySelectorAll<HTMLElement>("[data-merge]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); openMergeModal(btn.dataset.merge!); });
		});
		document.querySelectorAll<HTMLElement>("[data-unmerge]").forEach((btn) => {
			btn.addEventListener("click", (e) => { e.stopPropagation(); void handleUnmerge(btn.dataset.unmerge!, render); });
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
		bindTogglePublicButtons();
		bindMoreButtons();
	}

	function bindTogglePublicButtons(): void {
		document.querySelectorAll<HTMLElement>("[data-toggle-public]").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.stopPropagation();
				const id = btn.dataset.togglePublic!;
				const isPublic = btn.dataset.isPublic === "1";
				try {
					await setDeckPublic(id, !isPublic);
					const deck = state.decks.find((d) => d.id === id);
					if (deck) deck.isPublic = !isPublic;
					showToast(isPublic ? "Deck is nu privé" : "Deck is nu publiek zichtbaar");
					render();
				} catch (err) {
					showToast(err instanceof Error ? err.message : "Opslaan mislukt", true);
				}
			});
		});
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

	// â”€â”€ Add deck modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
		if (e.key === "Escape") {
			if (!document.getElementById("add-deck-modal")?.classList.contains("hidden")) closeAddDeckModal();
			if (!document.getElementById("split-deck-modal")?.classList.contains("hidden")) closeSplitModal();
			if (!document.getElementById("merge-deck-modal")?.classList.contains("hidden")) closeMergeModal();
			if (!document.getElementById("mix-deck-modal")?.classList.contains("hidden")) closeMixModal();
		}
	};
	document.addEventListener("keydown", _escapeKeyHandler);


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
			showToast(`”${esc(data.name)}” geïmporteerd ✓`);
			render();
		} catch {
			showToast("Kan JSON-bestand niet lezen", true);
		}
	});

	// Deck card events for initial render
	document.querySelectorAll<HTMLElement>(".deck-card").forEach((card) => {
		card.addEventListener("click", (e) => {
			const t = e.target as HTMLElement;
			if (t.closest("[data-delete]") || t.closest("[data-split]") || t.closest("[data-export]") || t.closest("[data-study]") || t.closest("[data-stats]") || t.closest("[data-edit]") || t.closest("[data-toggle-public]") || t.closest(".deck-more")) return;
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

	document.querySelectorAll<HTMLElement>("[data-split]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			openSplitModal(btn.dataset.split!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-merge]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			openMergeModal(btn.dataset.merge!);
		});
	});

	document.querySelectorAll<HTMLElement>("[data-unmerge]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			void handleUnmerge(btn.dataset.unmerge!, render);
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
	bindTogglePublicButtons();
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

	// Merge deck modal
	document.getElementById("merge-modal-close")?.addEventListener("click", closeMergeModal);
	document.getElementById("merge-deck-modal")?.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).id === "merge-deck-modal") closeMergeModal();
	});
	const mergeSearchInput = document.getElementById("merge-search") as HTMLInputElement | null;
	mergeSearchInput?.addEventListener("input", () => {
		if (_mergeDeckId) renderMergeDeckList(_mergeDeckId, mergeSearchInput.value);
	});
	document.getElementById("btn-confirm-merge")?.addEventListener("click", async () => {
		const base = _mergeDeckId ? state.decks.find((d) => d.id === _mergeDeckId) : null;
		if (!base) return;
		const nameInput = document.getElementById("merge-name-input") as HTMLInputElement | null;
		const name = nameInput?.value.trim() ?? base.name;
		if (!name) { showToast("Voer een naam in voor het samengevoegde deck", true); return; }
		const selectedDecks = Array.from(document.querySelectorAll<HTMLElement>(".merge-deck-card--selected"))
			.map((el) => state.decks.find((d) => d.id === el.dataset.mergeId))
			.filter(Boolean) as typeof state.decks;
		if (selectedDecks.length === 0) { showToast("Selecteer minimaal één deck om samen te voegen", true); return; }
		const btn = document.getElementById("btn-confirm-merge") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Samenvoegen…";
		try {
			const allCards = [
				...base.cards,
				...selectedDecks.flatMap((d) => d.cards),
			].map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() }));
			const merged: Deck = {
				id: crypto.randomUUID(),
				name,
				cards: allCards,
				createdAt: new Date(),
				creatorUsername: state.user?.username ?? undefined,
				tags: [],
				color: base.color ?? "",
				mergedFrom: [base, ...selectedDecks].map((d) => ({
					name: d.name,
					cards: d.cards.map((c) => ({ ...c })),
					tags: d.tags ? [...d.tags] : [],
					color: d.color ?? "",
				})),
			};
			if (state.user) {
				await insertDeck(merged);
				state.decks = await fetchDecks();
				state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
			} else {
				state.decks.push(merged);
				saveDecks(state.decks);
			}
			closeMergeModal();
			showToast(`"${name}" aangemaakt met ${allCards.length} kaarten ✓`);
			render();
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Samenvoegen mislukt", true);
			btn.disabled = false;
			btn.innerHTML = "Samenvoegen <i data-lucide=\"git-merge\"></i>";
		}
	});

	// Mix deck modal
	document.getElementById("btn-open-mix-modal")?.addEventListener("click", openMixModal);
	document.getElementById("mix-modal-close")?.addEventListener("click", closeMixModal);
	document.getElementById("mix-deck-modal")?.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).id === "mix-deck-modal") closeMixModal();
	});
	const mixSearchInput = document.getElementById("mix-search") as HTMLInputElement | null;
	mixSearchInput?.addEventListener("input", () => renderMixDeckList(mixSearchInput.value));
	document.getElementById("mix-tag-row")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-mix-tag]");
		if (!btn) return;
		const tag = btn.dataset.mixTag!;
		const deckIds = state.decks.filter((d) => (d.tags ?? []).includes(tag)).map((d) => d.id);
		document.querySelectorAll<HTMLElement>("[data-mix-id]").forEach((card) => {
			if (deckIds.includes(card.dataset.mixId!)) {
				card.classList.add("merge-deck-card--selected", "mix-deck-card--selected");
			}
		});
		updateMixPreview();
	});
	document.getElementById("btn-confirm-mix")?.addEventListener("click", () => {
		const selected = Array.from(document.querySelectorAll<HTMLElement>(".mix-deck-card--selected"))
			.map((el) => state.decks.find((d) => d.id === el.dataset.mixId))
			.filter(Boolean) as typeof state.decks;
		if (selected.length === 0) { showToast("Selecteer minimaal één deck", true); return; }
		const allCards = shuffle(selected.flatMap((d) => d.cards).map((c) => ({ ...c })));
		const name = selected.length === 1
			? selected[0].name
			: `${selected.map((d) => d.name).slice(0, 2).join(" + ")}${selected.length > 2 ? ` +${selected.length - 2}` : ""}`;
		state.mixStudyName = name;
		state.activeDeckId = null;
		state.studyCards = allCards;
		state.cardIndex = 0; state.flipped = false; state.correct = 0; state.wrong = 0;
		state.missed = []; state.cardQualities = {}; state.studyStartTime = 0; state.lastCardSnapshot = null;
		state.view = "study-mode-pick";
		closeMixModal();
		render();
	});

	// Split deck modal
	document.getElementById("split-modal-close")?.addEventListener("click", closeSplitModal);
	document.getElementById("split-deck-modal")?.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).id === "split-deck-modal") closeSplitModal();
	});
	const splitInput = document.getElementById("split-parts-input") as HTMLInputElement | null;
	splitInput?.addEventListener("input", () => {
		const deck = _splitDeckId ? state.decks.find((d) => d.id === _splitDeckId) : null;
		if (deck) updateSplitPreview(deck.cards.length, parseInt(splitInput.value) || 0);
	});
	document.getElementById("btn-confirm-split")?.addEventListener("click", async () => {
		const deck = _splitDeckId ? state.decks.find((d) => d.id === _splitDeckId) : null;
		if (!deck) return;
		const parts = parseInt(splitInput?.value ?? "2");
		if (isNaN(parts) || parts < 2 || parts > deck.cards.length) {
			showToast("Kies een geldig aantal delen (minimaal 2, maximaal het aantal kaarten)", true);
			return;
		}
		const btn = document.getElementById("btn-confirm-split") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Splitsen…";
		try {
			const shuffled = [...deck.cards];
			const base = Math.floor(shuffled.length / parts);
			const remainder = shuffled.length % parts;
			let offset = 0;
			const newDecks: Deck[] = [];
			for (let i = 0; i < parts; i++) {
				const size = base + (i < remainder ? 1 : 0);
				newDecks.push({
					id: crypto.randomUUID(),
					name: `${deck.name} (${i + 1}/${parts})`,
					cards: shuffled.slice(offset, offset + size).map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() })),
					createdAt: new Date(),
					creatorUsername: state.user?.username ?? undefined,
					tags: deck.tags ? [...deck.tags] : [],
					color: deck.color ?? "",
				});
				offset += size;
			}
			if (state.user) {
				for (const d of newDecks) await insertDeck(d);
				state.decks = await fetchDecks();
				state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
			} else {
				state.decks.push(...newDecks);
				saveDecks(state.decks);
			}
			closeSplitModal();
			showToast(`"${deck.name}" gesplitst in ${parts} delen ✓`);
			render();
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Splitsen mislukt", true);
			btn.disabled = false;
			btn.innerHTML = "Splitsen <i data-lucide=\"scissors\"></i>";
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

async function handleUnmerge(deckId: string, render: () => void): Promise<void> {
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck?.mergedFrom?.length) return;
	const parts = deck.mergedFrom;
	if (!confirm(`"${deck.name}" loskoppelen in ${parts.length} originele decks? Het samengevoegde deck wordt verwijderd.`)) return;
	try {
		const newDecks: Deck[] = parts.map((p) => ({
			id: crypto.randomUUID(),
			name: p.name,
			cards: p.cards.map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() })),
			createdAt: new Date(),
			creatorUsername: state.user?.username ?? undefined,
			tags: p.tags ? [...p.tags] : [],
			color: p.color ?? "",
		}));
		if (state.user) {
			for (const d of newDecks) await insertDeck(d);
			await removeDeck(deckId);
			state.decks = await fetchDecks();
			state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
		} else {
			state.decks = state.decks.filter((d) => d.id !== deckId);
			state.decks.push(...newDecks);
			saveDecks(state.decks);
		}
		showToast(`Losgekoppeld in ${parts.length} decks ✓`);
		render();
	} catch (err) {
		showToast(err instanceof Error ? err.message : "Loskoppelen mislukt", true);
	}
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
