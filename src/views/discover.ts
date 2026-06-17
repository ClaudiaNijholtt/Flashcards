import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { fetchPublicDecks, insertDeck, fetchDecks, fetchDeckPlayCounts } from "../services/decks";
import type { Deck } from "../types";

export function renderDiscover(): string {
	return `
    <div class="discover-view">
      <div class="discover-header">
        <button class="btn" id="btn-discover-back"><i data-lucide="arrow-left"></i> Terug</button>
        <h2 class="discover-title">Decks ontdekken</h2>
      </div>
      <div class="discover-search-wrap">
        <i data-lucide="search" class="discover-search__icon"></i>
        <input type="search" id="discover-search" class="discover-search" placeholder="Zoeken in publieke decks…" autocomplete="off" />
      </div>
      <div id="discover-results" class="discover-results">
      </div>
    </div>
  `;
}

export function bindDiscoverEvents(render: () => void): void {
	document.getElementById("btn-discover-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const searchInput = document.getElementById("discover-search") as HTMLInputElement | null;
	searchInput?.addEventListener("input", () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => loadResults(searchInput.value), 300);
	});

	void loadResults("");
}

async function loadResults(query: string): Promise<void> {
	const resultsEl = document.getElementById("discover-results");
	if (!resultsEl) return;

	resultsEl.innerHTML = `<div class="discover-loading">Laden…</div>`;

	let decks: Deck[];
	try {
		decks = await fetchPublicDecks(query);
	} catch (err) {
		resultsEl.innerHTML = `<div class="discover-empty">${esc(err instanceof Error ? err.message : "Laden mislukt")}</div>`;
		return;
	}

	if (decks.length === 0) {
		resultsEl.innerHTML = `<div class="discover-empty">Geen publieke decks gevonden${query ? ` voor "<strong>${esc(query)}</strong>"` : ""}.</div>`;
		return;
	}

	resultsEl.innerHTML = decks.map((deck) => {
		const tagsHtml = (deck.tags ?? []).length > 0
			? `<div class="deck-card__tags" style="margin-top:4px">${(deck.tags ?? []).map((name) => `<span class="deck-tag-pill">${esc(name)}</span>`).join("")}</div>`
			: "";
		return `
      <div class="discover-card">
        <div class="discover-card__info">
          <div class="discover-card__name">${esc(deck.name)}</div>
          <div class="discover-card__meta">
            ${deck.cards.length} kaarten${deck.creatorUsername ? ` · door ${esc(deck.creatorUsername)}` : ""}
          </div>
          ${tagsHtml}
        </div>
        <button class="btn-primary discover-card__copy" data-copy-id="${esc(deck.id)}">
          Overnemen <i data-lucide="copy"></i>
        </button>
      </div>`;
	}).join("");

	import("lucide").then(({ createIcons, Copy }) => createIcons({ icons: { Copy } }));

	document.querySelectorAll<HTMLElement>("[data-copy-id]").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const deckId = btn.dataset.copyId!;
			const deck = decks.find((d) => d.id === deckId);
			if (!deck) return;

			btn.setAttribute("disabled", "true");

			const copy: Deck = {
				id: crypto.randomUUID(),
				name: deck.name,
				cards: deck.cards.map((c) => ({ ...c, id: c.id ?? crypto.randomUUID() })),
				createdAt: new Date(),
				creatorUsername: deck.creatorUsername,
				tags: deck.tags ? [...deck.tags] : [],
				color: deck.color ?? "",
				isPublic: false,
			};

			try {
				if (state.user) {
					await insertDeck(copy);
					state.decks = await fetchDecks();
					state.deckPlayCounts = await fetchDeckPlayCounts(state.decks.map((d) => d.id));
				}
				showToast(`"${deck.name}" overgenomen ✓`);
			} catch (err) {
				showToast(err instanceof Error ? err.message : "Overnemen mislukt", true);
			} finally {
				btn.removeAttribute("disabled");
			}
		});
	});
}
