import { state } from "../state";
import { esc } from "../utils/helpers";

interface Tile {
	id: string;
	text: string;
	type: "question" | "answer";
	pairId: string;
}

let _tiles: Tile[] = [];
let _selected: number | null = null;
let _matched: Set<string> = new Set();
let _startTime = 0;
let _wrong = 0;
let _checking = false;
let _timerInterval: ReturnType<typeof setInterval> | null = null;

function shuffleArray<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function renderMatchGame(): string {
	const deck = state.decks.find((d) => d.id === state.matchDeckId);
	if (!deck) return `<p>Deck niet gevonden.</p>`;

	if (_tiles.length === 0) {
		_selected = null;
		_matched = new Set();
		_wrong = 0;
		_checking = false;
		_startTime = Date.now();

		const cards = deck.cards.slice(0, 6);
		const tiles: Tile[] = [];
		for (const card of cards) {
			tiles.push({ id: crypto.randomUUID(), text: card.question, type: "question", pairId: card.id });
			tiles.push({ id: crypto.randomUUID(), text: card.answer, type: "answer", pairId: card.id });
		}
		_tiles = shuffleArray(tiles);
	}

	const tilesHtml = _tiles
		.map(
			(tile, idx) => `<button class="match-tile${_matched.has(tile.pairId) ? " match-tile--matched" : ""}" data-tile-idx="${idx}" data-pair-id="${esc(tile.pairId)}" data-type="${tile.type}">${esc(tile.text)}</button>`,
		)
		.join("");

	return `
    <div class="match-header">
      <button class="btn" id="btn-match-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="match-header__title">${esc(deck.name)}</div>
      <div class="match-stats">
        <span id="match-wrong">${_wrong} ${_wrong === 1 ? "fout" : "fouten"}</span>
        <span class="match-stats__sep">·</span>
        <span id="match-timer">0:00</span>
      </div>
    </div>
    <div class="match-grid" id="match-grid">
      ${tilesHtml}
    </div>
    <div class="match-complete hidden" id="match-complete">
      <div class="match-complete__icon"><i data-lucide="trophy"></i></div>
      <h2>Voltooid!</h2>
      <p id="match-result-text"></p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:1rem">
        <button class="btn-primary" id="btn-match-restart">Opnieuw</button>
        <button class="btn" id="btn-match-home">Terug naar home</button>
      </div>
    </div>
  `;
}

export function bindMatchGameEvents(render: () => void): void {
	startTimer();

	document.getElementById("btn-match-back")?.addEventListener("click", () => {
		cleanupMatchGame();
		state.view = "home";
		render();
	});

	document.getElementById("btn-match-restart")?.addEventListener("click", () => {
		cleanupMatchGame();
		render();
	});

	document.getElementById("btn-match-home")?.addEventListener("click", () => {
		cleanupMatchGame();
		state.view = "home";
		render();
	});

	document.getElementById("match-grid")?.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-tile-idx]");
		if (!btn) return;

		if (_checking || btn.classList.contains("match-tile--matched")) return;

		const idx = parseInt(btn.dataset.tileIdx!, 10);

		if (_selected === null) {
			_selected = idx;
			btn.classList.add("match-tile--selected");
			return;
		}

		if (_selected === idx) {
			_selected = null;
			btn.classList.remove("match-tile--selected");
			return;
		}

		const firstBtn = document.querySelector<HTMLElement>(`[data-tile-idx="${_selected}"]`);
		if (!firstBtn) return;

		_checking = true;

		const firstPairId = firstBtn.dataset.pairId!;
		const firstType = firstBtn.dataset.type!;
		const secondPairId = btn.dataset.pairId!;
		const secondType = btn.dataset.type!;

		if (firstPairId === secondPairId && firstType !== secondType) {
			firstBtn.classList.add("match-tile--correct");
			btn.classList.add("match-tile--correct");

			setTimeout(() => {
				firstBtn.classList.remove("match-tile--selected", "match-tile--correct");
				btn.classList.remove("match-tile--selected", "match-tile--correct");
				firstBtn.classList.add("match-tile--matched");
				btn.classList.add("match-tile--matched");

				_matched.add(firstPairId);

				const totalPairs = _tiles.length / 2;
				if (_matched.size === totalPairs) {
					stopTimer();
					const elapsed = Date.now() - _startTime;
					const timeStr = formatTime(elapsed);
					const completeEl = document.getElementById("match-complete");
					const resultText = document.getElementById("match-result-text");
					if (resultText) {
						resultText.textContent = `Tijd: ${timeStr} · ${_wrong} ${_wrong === 1 ? "fout" : "fouten"}`;
					}
					completeEl?.classList.remove("hidden");
				}

				_selected = null;
				_checking = false;
			}, 400);
		} else {
			_wrong++;
			const wrongEl = document.getElementById("match-wrong");
			if (wrongEl) wrongEl.textContent = `${_wrong} ${_wrong === 1 ? "fout" : "fouten"}`;

			firstBtn.classList.add("match-tile--wrong");
			btn.classList.add("match-tile--wrong");

			setTimeout(() => {
				firstBtn.classList.remove("match-tile--wrong", "match-tile--selected");
				btn.classList.remove("match-tile--wrong", "match-tile--selected");
				_selected = null;
				_checking = false;
			}, 600);
		}
	});
}

function startTimer(): void {
	stopTimer();
	_timerInterval = setInterval(() => {
		const el = document.getElementById("match-timer");
		if (el) el.textContent = formatTime(Date.now() - _startTime);
	}, 1000);
}

function stopTimer(): void {
	if (_timerInterval !== null) {
		clearInterval(_timerInterval);
		_timerInterval = null;
	}
}

export function cleanupMatchGame(): void {
	stopTimer();
	_tiles = [];
	_selected = null;
	_matched = new Set();
	_wrong = 0;
	_checking = false;
	_startTime = 0;
}
