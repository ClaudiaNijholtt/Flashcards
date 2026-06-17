import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { updateDeckMeta, updateDeckCards } from "../services/decks";
import { saveTagLibrary } from "../services/profiles";
import { saveUserTags } from "../utils/storage";
import { uploadCardImage } from "../services/storage-media";
import { DECK_COLORS } from "../types";
import type { Flashcard, UserTag } from "../types";

let _editingTags: string[] = [];
let _newTagColor: string = DECK_COLORS[0].hex;

function tagHex(name: string): string {
	return state.userTags.find((t) => t.name === name)?.color ?? "#6b7280";
}

function renderSelectedChips(): string {
	if (_editingTags.length === 0) {
		return `<span class="tag-editor__empty">Geen tags — klik op Toevoegen</span>`;
	}
	return _editingTags.map((name) => {
		const hex = tagHex(name);
		return `<button type="button" class="tag-chip-deck" data-tag-remove="${esc(name)}" style="--chip-color:${hex};--chip-bg:${hex}26;--chip-border:${hex}66;" title="${esc(name)} verwijderen">
			${esc(name)} <span class="tag-chip-deck__x" aria-hidden="true">×</span>
		</button>`;
	}).join("");
}

function renderAvailableChips(): string {
	const available = state.userTags.filter((t) => !_editingTags.includes(t.name));
	if (state.userTags.length === 0) {
		return `<span class="tag-editor__hint">Maak hieronder je eerste tag aan</span>`;
	}
	if (available.length === 0) {
		return `<span class="tag-editor__hint">Alle tags zijn al toegevoegd</span>`;
	}
	return available.map((tag) =>
		`<button type="button" class="tag-chip-add" data-tag-add="${esc(tag.name)}" style="--chip-color:${tag.color};--chip-bg:${tag.color}26;">${esc(tag.name)}</button>`,
	).join("");
}

export function renderDeckEdit(): string {
	const deck = state.decks.find((d) => d.id === state.editDeckId);
	if (!deck) return `<p>Deck niet gevonden.</p>`;

	_editingTags = [...(deck.tags ?? [])];
	_newTagColor = DECK_COLORS[0].hex;

	const colorSwatchesForNewTag = DECK_COLORS.map((c, i) =>
		`<button type="button" class="color-swatch ${i === 0 ? "color-swatch--active" : ""}" data-new-tag-color="${c.hex}" title="${c.label}" style="--swatch-color:${c.hex}"></button>`,
	).join("");

	const cardsHtml = deck.cards
		.map(
			(card, i) => `
		<div class="card-edit-row" data-card-id="${esc(card.id)}">
			<div class="card-edit-row__num">${i + 1}</div>
			<div class="card-edit-fields">
				<textarea class="card-edit-question" rows="3" placeholder="Vraag" aria-label="Vraag ${i + 1}">${esc(card.question)}</textarea>
				<textarea class="card-edit-answer" rows="3" placeholder="Antwoord" aria-label="Antwoord ${i + 1}">${esc(card.answer)}</textarea>
				<div class="card-image-controls">
					<button class="btn btn-icon card-image-upload-btn" data-card-id="${esc(card.id)}" title="Afbeelding toevoegen"><i data-lucide="image"></i></button>
					<input type="file" class="card-image-input" data-card-id="${esc(card.id)}" accept="image/*" style="display:none">
					${card.imageUrl ? `<img class="card-image-thumb" src="${esc(card.imageUrl)}" alt=""><button class="btn-icon btn-icon--danger card-image-remove" data-card-id="${esc(card.id)}"><i data-lucide="x"></i></button>` : ""}
				</div>
			</div>
			<button class="btn-icon card-edit-row__delete" data-delete-card title="Kaart verwijderen" aria-label="Kaart verwijderen">
				<i data-lucide="trash-2"></i>
			</button>
		</div>`,
		)
		.join("");

	return `
		<div class="deck-edit-view">
			<div class="deck-edit-header">
				<button class="btn-icon" id="deck-edit-back" title="Terug" aria-label="Terug">
					<i data-lucide="arrow-left"></i>
				</button>
				<input
					type="text"
					id="deck-edit-name"
					class="deck-edit-name-input"
					value="${esc(deck.name)}"
					placeholder="Decknaam"
					aria-label="Decknaam"
				/>
				<button class="btn-primary" id="deck-edit-save">
					<i data-lucide="save"></i> Opslaan
				</button>
			</div>

			<div class="deck-edit-section">
				<label class="deck-edit-label">Tags</label>
				<div class="tag-editor">
					<div class="tag-editor__chips" id="tag-editor-selected">${renderSelectedChips()}</div>
					<button type="button" class="tag-editor__toggle" id="tag-editor-open">
						<i data-lucide="plus"></i> Toevoegen
					</button>
				</div>
				<div class="tag-editor__panel hidden" id="tag-editor-panel">
					<div class="tag-editor__avail-label">Klik om toe te voegen</div>
					<div class="tag-editor__avail" id="tag-editor-available">${renderAvailableChips()}</div>
					<div class="tag-editor__new">
						<div class="tag-editor__new-row">
							<input type="text" id="tag-new-name" class="tag-editor__new-input" placeholder="Nieuwe tag naam…" maxlength="32" autocomplete="off" />
							<button type="button" class="btn-primary" id="tag-new-submit">Aanmaken</button>
						</div>
						<div class="color-picker" id="tag-new-colors">${colorSwatchesForNewTag}</div>
					</div>
				</div>
			</div>

			<div class="card-edit-list" id="card-edit-list">
				${cardsHtml}
			</div>

			<div class="deck-edit-footer">
				<button class="btn" id="deck-edit-add-card">
					<i data-lucide="plus"></i> Kaart toevoegen
				</button>
			</div>
		</div>
	`;
}

export function bindDeckEditEvents(render: () => void): void {
	document.getElementById("deck-edit-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	// ── Tag editor ────────────────────────────────────────────────────────────

	document.getElementById("tag-editor-open")?.addEventListener("click", () => {
		const panel = document.getElementById("tag-editor-panel");
		panel?.classList.toggle("hidden");
		if (!panel?.classList.contains("hidden")) {
			(document.getElementById("tag-new-name") as HTMLInputElement | null)?.focus();
		}
	});

	document.getElementById("tag-editor-selected")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-tag-remove]");
		if (!btn) return;
		_editingTags = _editingTags.filter((t) => t !== btn.dataset.tagRemove);
		updateTagEditorDOM();
	});

	document.getElementById("tag-editor-available")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-tag-add]");
		if (!btn) return;
		const name = btn.dataset.tagAdd ?? "";
		if (name && !_editingTags.includes(name)) _editingTags.push(name);
		updateTagEditorDOM();
	});

	document.getElementById("tag-new-colors")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-new-tag-color]");
		if (!btn) return;
		_newTagColor = btn.dataset.newTagColor ?? DECK_COLORS[0].hex;
		document.querySelectorAll<HTMLElement>("#tag-new-colors .color-swatch").forEach((s) => s.classList.remove("color-swatch--active"));
		btn.classList.add("color-swatch--active");
	});

	const tagNameInput = document.getElementById("tag-new-name") as HTMLInputElement | null;
	tagNameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("tag-new-submit")?.click(); });

	document.getElementById("tag-new-submit")?.addEventListener("click", async () => {
		const name = tagNameInput?.value.trim() ?? "";
		if (!name) { showToast("Geef de tag een naam", true); return; }
		if (state.userTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
			showToast("Er bestaat al een tag met deze naam", true); return;
		}
		const newTag: UserTag = { name, color: _newTagColor };
		state.userTags.push(newTag);
		_editingTags.push(name);
		if (tagNameInput) tagNameInput.value = "";

		// Save locally first (always works), then sync to Supabase in background
		saveUserTags(state.userTags);
		if (state.user) void saveTagLibrary(state.userTags);

		updateTagEditorDOM();
		showToast(`Tag "${name}" aangemaakt ✓`);
	});

	// ── Card list ─────────────────────────────────────────────────────────────

	const cardList = document.getElementById("card-edit-list");
	cardList?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-delete-card]");
		if (!btn) return;
		btn.closest<HTMLElement>(".card-edit-row")?.remove();
		renumberRows();
	});

	document.getElementById("deck-edit-add-card")?.addEventListener("click", () => {
		const list = document.getElementById("card-edit-list");
		if (!list) return;
		const newId = crypto.randomUUID();
		const count = list.querySelectorAll(".card-edit-row").length + 1;
		const row = document.createElement("div");
		row.className = "card-edit-row";
		row.dataset.cardId = newId;
		row.innerHTML = `
			<div class="card-edit-row__num">${count}</div>
			<div class="card-edit-fields">
				<textarea class="card-edit-question" rows="3" placeholder="Vraag" aria-label="Vraag ${count}"></textarea>
				<textarea class="card-edit-answer" rows="3" placeholder="Antwoord" aria-label="Antwoord ${count}"></textarea>
			</div>
			<button class="btn-icon card-edit-row__delete" data-delete-card title="Kaart verwijderen" aria-label="Kaart verwijderen">
				<i data-lucide="trash-2"></i>
			</button>
		`;
		list.appendChild(row);
		import("lucide").then(({ createIcons, Trash2 }) => createIcons({ icons: { Trash2 } }));
		row.querySelector("textarea")?.focus();
	});

	// ── Card images ───────────────────────────────────────────────────────────

	document.querySelectorAll<HTMLElement>(".card-image-upload-btn").forEach(btn => {
		btn.addEventListener("click", () => {
			const input = document.querySelector<HTMLInputElement>(`.card-image-input[data-card-id="${btn.dataset.cardId}"]`);
			input?.click();
		});
	});

	document.querySelectorAll<HTMLInputElement>(".card-image-input").forEach(input => {
		input.addEventListener("change", async () => {
			const file = input.files?.[0];
			if (!file || !state.user) return;
			const cardId = input.dataset.cardId!;
			try {
				const url = await uploadCardImage(file, state.user.id, cardId);
				const deck = state.decks.find(d => d.id === state.editDeckId);
				if (deck) {
					const card = deck.cards.find(c => c.id === cardId);
					if (card) {
						card.imageUrl = url;
						await updateDeckCards(deck.id, deck.cards);
					}
				}
				render();
			} catch (err) { showToast(err instanceof Error ? err.message : "Upload mislukt", true); }
		});
	});

	document.querySelectorAll<HTMLElement>(".card-image-remove").forEach(btn => {
		btn.addEventListener("click", async () => {
			const cardId = btn.dataset.cardId!;
			const deck = state.decks.find(d => d.id === state.editDeckId);
			if (!deck) return;
			const card = deck.cards.find(c => c.id === cardId);
			if (card) { card.imageUrl = undefined; await updateDeckCards(deck.id, deck.cards); render(); }
		});
	});

	// ── Save ──────────────────────────────────────────────────────────────────

	document.getElementById("deck-edit-save")?.addEventListener("click", async () => {
		const deck = state.decks.find((d) => d.id === state.editDeckId);
		if (!deck) return;

		const nameInput = document.getElementById("deck-edit-name") as HTMLInputElement | null;
		const newName = nameInput?.value.trim() ?? deck.name;
		if (!newName) { showToast("Decknaam mag niet leeg zijn", true); return; }

		const rows = document.querySelectorAll<HTMLElement>(".card-edit-row");
		const cards: Flashcard[] = [];
		for (const row of rows) {
			const question = (row.querySelector(".card-edit-question") as HTMLTextAreaElement | null)?.value.trim() ?? "";
			const answer = (row.querySelector(".card-edit-answer") as HTMLTextAreaElement | null)?.value.trim() ?? "";
			const cardId = row.dataset.cardId ?? crypto.randomUUID();
			const existingCard = deck.cards.find(c => c.id === cardId);
			cards.push({ id: cardId, question, answer, ...(existingCard?.imageUrl ? { imageUrl: existingCard.imageUrl } : {}) });
		}

		deck.name = newName;
		deck.cards = cards;
		deck.tags = [..._editingTags];

		if (state.user) {
			try {
				await updateDeckMeta(deck.id, newName, [..._editingTags], deck.color ?? "");
				await updateDeckCards(deck.id, cards);
			} catch (err) {
				showToast(err instanceof Error ? err.message : "Opslaan mislukt", true);
				return;
			}
		}

		showToast("Deck opgeslagen ✓");
		state.view = "home";
		render();
	});
}

function updateTagEditorDOM(): void {
	const sel = document.getElementById("tag-editor-selected");
	if (sel) sel.innerHTML = renderSelectedChips();
	const avail = document.getElementById("tag-editor-available");
	if (avail) avail.innerHTML = renderAvailableChips();
}

function renumberRows(): void {
	document.querySelectorAll<HTMLElement>(".card-edit-row").forEach((row, i) => {
		const numEl = row.querySelector<HTMLElement>(".card-edit-row__num");
		if (numEl) numEl.textContent = String(i + 1);
	});
}
