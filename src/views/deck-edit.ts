import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { renameDeck, updateDeckCards } from "../services/decks";
import type { Flashcard } from "../types";

export function renderDeckEdit(): string {
	const deck = state.decks.find((d) => d.id === state.editDeckId);
	if (!deck) return `<p>Deck niet gevonden.</p>`;

	const cardsHtml = deck.cards
		.map(
			(card, i) => `
		<div class="card-edit-row" data-card-id="${esc(card.id)}">
			<div class="card-edit-row__num">${i + 1}</div>
			<div class="card-edit-fields">
				<textarea
					class="card-edit-question"
					rows="3"
					placeholder="Vraag"
					aria-label="Vraag ${i + 1}"
				>${esc(card.question)}</textarea>
				<textarea
					class="card-edit-answer"
					rows="3"
					placeholder="Antwoord"
					aria-label="Antwoord ${i + 1}"
				>${esc(card.answer)}</textarea>
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
	// Back button
	document.getElementById("deck-edit-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	// Delete card buttons (event delegation on the list)
	const cardList = document.getElementById("card-edit-list");
	cardList?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-delete-card]");
		if (!btn) return;
		const row = btn.closest<HTMLElement>(".card-edit-row");
		if (!row) return;
		row.remove();
		// Re-number remaining rows
		renumberRows();
	});

	// Add card button
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
				<textarea
					class="card-edit-question"
					rows="3"
					placeholder="Vraag"
					aria-label="Vraag ${count}"
				></textarea>
				<textarea
					class="card-edit-answer"
					rows="3"
					placeholder="Antwoord"
					aria-label="Antwoord ${count}"
				></textarea>
			</div>
			<button class="btn-icon card-edit-row__delete" data-delete-card title="Kaart verwijderen" aria-label="Kaart verwijderen">
				<i data-lucide="trash-2"></i>
			</button>
		`;
		list.appendChild(row);
		// Render the Lucide icon in the new row
		import("lucide").then(({ createIcons, Trash2 }) => createIcons({ icons: { Trash2 } }));
		row.querySelector("textarea")?.focus();
	});

	// Save button
	document.getElementById("deck-edit-save")?.addEventListener("click", async () => {
		const deck = state.decks.find((d) => d.id === state.editDeckId);
		if (!deck) return;

		const nameInput = document.getElementById("deck-edit-name") as HTMLInputElement | null;
		const newName = nameInput?.value.trim() ?? deck.name;
		if (!newName) {
			showToast("Decknaam mag niet leeg zijn", true);
			return;
		}

		// Collect all card rows from DOM
		const rows = document.querySelectorAll<HTMLElement>(".card-edit-row");
		const cards: Flashcard[] = [];
		for (const row of rows) {
			const question = (row.querySelector(".card-edit-question") as HTMLTextAreaElement | null)?.value.trim() ?? "";
			const answer = (row.querySelector(".card-edit-answer") as HTMLTextAreaElement | null)?.value.trim() ?? "";
			const id = row.dataset.cardId ?? crypto.randomUUID();
			cards.push({ id, question, answer });
		}

		// Update state
		deck.name = newName;
		deck.cards = cards;

		// Persist to Supabase if logged in
		if (state.user) {
			try {
				await renameDeck(deck.id, newName);
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

function renumberRows(): void {
	const rows = document.querySelectorAll<HTMLElement>(".card-edit-row");
	rows.forEach((row, i) => {
		const numEl = row.querySelector<HTMLElement>(".card-edit-row__num");
		if (numEl) numEl.textContent = String(i + 1);
	});
}
