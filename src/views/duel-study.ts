import { state } from "../state";
import { esc } from "../utils/helpers";
import { duelChannel } from "../services/realtime";
import { saveDuelScore } from "../services/duels";
import type { Flashcard } from "../types";

interface Option { answer: string; isCorrect: boolean; }

// Module-level state — survives re-renders caused by opponent progress updates
let optionsCardIndex = -1;
let currentOptions: Option[] = [];
let selectedOptionIndex: number | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function buildOptions(cards: Flashcard[], cardIndex: number): Option[] {
	const correct = cards[cardIndex].answer;
	const distractors = cards
		.filter((_, i) => i !== cardIndex)
		.map((c) => c.answer)
		.sort(() => Math.random() - 0.5)
		.slice(0, 3);

	const opts: Option[] = [
		{ answer: correct, isCorrect: true },
		...distractors.map((a) => ({ answer: a, isCorrect: false })),
	];
	return opts.sort(() => Math.random() - 0.5);
}

function optionClass(idx: number): string {
	if (selectedOptionIndex === null) return "";
	if (currentOptions[idx].isCorrect) return " duel-option--correct";
	if (idx === selectedOptionIndex) return " duel-option--wrong";
	return " duel-option--neutral";
}

export function renderDuelStudy(): string {
	const duel = state.duel!;
	const total = duel.cards.length;
	const selfDone = duel.correct + duel.wrong;
	const selfPct = Math.round((selfDone / total) * 100);
	const oppDone = duel.opponent?.cardsDone ?? 0;
	const oppPct = Math.round((oppDone / total) * 100);

	if (duel.selfFinished) {
		return `
      <div class="duel-waiting">
        <div class="duel-lobby__spinner"></div>
        <p class="duel-waiting__title">Klaar! Wachten op tegenstander…</p>
        <div class="duel-waiting__scores">
          <div>${esc(duel.selfName)} &nbsp; <span class="ok"><i data-lucide="check"></i> ${duel.correct}</span> <span class="no"><i data-lucide="x"></i> ${duel.wrong}</span></div>
          <div>${esc(duel.opponent?.name ?? "Tegenstander")} &nbsp; <span class="ok"><i data-lucide="check"></i> ${duel.opponent?.correct ?? 0}</span> <span class="no"><i data-lucide="x"></i> ${duel.opponent?.wrong ?? 0}</span> ${duel.opponent?.finished ? "· klaar" : "· bezig"}</div>
        </div>
        <div class="duel-opponent-prog">
          <span class="duel-player__label">Tegenstander</span>
          <div class="prog-bar"><div class="prog-fill prog-fill--opp" id="opp-bar" style="width:${oppPct}%"></div></div>
          <span id="opp-done">${oppDone}/${total}</span>
        </div>
      </div>
    `;
	}

	// Ensure options are stable for this card across re-renders
	if (duel.cardIndex !== optionsCardIndex) {
		optionsCardIndex = duel.cardIndex;
		selectedOptionIndex = null;
		currentOptions = buildOptions(duel.cards, duel.cardIndex);
	}

	const card = duel.cards[duel.cardIndex];
	const answered = selectedOptionIndex !== null;
	const letters = ["A", "B", "C", "D"];

	return `
    <div class="duel-scoreboard">
      <div class="duel-player">
        <span class="duel-player__label">${esc(duel.selfName)}</span>
        <div class="prog-bar"><div class="prog-fill" style="width:${selfPct}%"></div></div>
        <span class="duel-player__count">${selfDone}/${total}</span>
      </div>
      <div class="duel-vs">VS</div>
      <div class="duel-player duel-player--opp">
        <span class="duel-player__label">${esc(duel.opponent?.name ?? "Tegenstander")}</span>
        <div class="prog-bar"><div class="prog-fill prog-fill--opp" id="opp-bar" style="width:${oppPct}%"></div></div>
        <span class="duel-player__count" id="opp-done">${oppDone}/${total}</span>
      </div>
    </div>

    <div class="duel-question-card">
      <div class="duel-question-card__deck">${esc(duel.deckName)}</div>
      <div class="duel-question-card__q">${esc(card.question)}</div>
      ${!answered ? `<div class="duel-question-card__hint">Kies het juiste antwoord</div>` : ""}
    </div>

    <div class="duel-options${answered ? " duel-options--answered" : ""}">
      ${currentOptions.map((opt, i) => `
        <button
          class="duel-option${optionClass(i)}"
          data-idx="${i}"
          ${answered ? "disabled" : ""}
        >
          <span class="duel-option__letter">${letters[i]}</span>
          <span class="duel-option__text">${esc(opt.answer)}</span>
        </button>
      `).join("")}
    </div>

    <div class="mark-row${answered ? " visible" : ""}" id="next-row">
      <button class="btn-primary" id="btn-next">
        ${duel.cardIndex < duel.cards.length - 1 ? `Volgende <i data-lucide="arrow-right"></i>` : `Klaar <i data-lucide="check"></i>`}
      </button>
    </div>
  `;
}

export function bindDuelStudyEvents(render: () => void): void {
	const ch = duelChannel.get();
	if (ch) {
		ch.on("broadcast", { event: "duel-progress" }, ({ payload }) => {
			if (!state.duel?.opponent) return;
			state.duel.opponent.cardsDone = payload.cardsDone as number;
			state.duel.opponent.correct = payload.correct as number;
			state.duel.opponent.wrong = payload.wrong as number;
			refreshOpponentBar();
		})
		.on("broadcast", { event: "duel-finished" }, ({ payload }) => {
			if (!state.duel?.opponent) return;
			state.duel.opponent.finished = true;
			state.duel.opponent.correct = payload.correct as number;
			state.duel.opponent.wrong = payload.wrong as number;
			state.duel.opponent.timeMs = payload.timeMs as number;

			if (state.duel.selfFinished) {
				state.view = "duel-result";
				render();
			} else {
				refreshOpponentBar();
			}
		});
	}

	document.querySelectorAll<HTMLButtonElement>(".duel-option").forEach((btn) => {
		btn.addEventListener("click", () => void selectOption(Number(btn.dataset.idx), render));
	});

	document.getElementById("btn-next")?.addEventListener("click", () => void advanceDuelCard(render));

	// Keyboard: 1-4 to select option, Space/Enter/→ to advance
	if (keyHandler) document.removeEventListener("keydown", keyHandler);
	keyHandler = (e: KeyboardEvent) => {
		if (state.view !== "duel-playing") {
			document.removeEventListener("keydown", keyHandler!);
			keyHandler = null;
			return;
		}
		const tag = (e.target as HTMLElement).tagName.toLowerCase();
		if (tag === "input" || tag === "textarea") return;

		if (selectedOptionIndex === null) {
			const idx = ["1", "2", "3", "4"].indexOf(e.key);
			if (idx !== -1 && idx < currentOptions.length) {
				e.preventDefault();
				void selectOption(idx, render);
			}
		} else if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
			e.preventDefault();
			void advanceDuelCard(render);
		}
	};
	document.addEventListener("keydown", keyHandler);
}

async function selectOption(idx: number, render: () => void): Promise<void> {
	const duel = state.duel;
	if (!duel || selectedOptionIndex !== null || duel.selfFinished) return;
	if (idx >= currentOptions.length) return;

	selectedOptionIndex = idx;
	const correct = currentOptions[idx].isCorrect;

	if (correct) duel.correct++;
	else duel.wrong++;

	const cardsDone = duel.cardIndex + 1;
	const ch = duelChannel.get();

	await ch?.send({
		type: "broadcast",
		event: "duel-progress",
		payload: { cardsDone, correct: duel.correct, wrong: duel.wrong },
	});

	render();
}

async function advanceDuelCard(render: () => void): Promise<void> {
	const duel = state.duel;
	if (!duel || selectedOptionIndex === null || duel.selfFinished) return;

	if (duel.cardIndex < duel.cards.length - 1) {
		duel.cardIndex++;
		duel.flipped = false;
		render();
	} else {
		const timeMs = Date.now() - duel.startTime;
		duel.selfFinished = true;
		duel.selfTimeMs = timeMs;
		const ch = duelChannel.get();

		await saveDuelScore(duel.id, duel.isHost, duel.correct, duel.wrong, timeMs);
		await ch?.send({
			type: "broadcast",
			event: "duel-finished",
			payload: { correct: duel.correct, wrong: duel.wrong, timeMs },
		});

		if (duel.opponent?.finished) {
			state.view = "duel-result";
		}
		render();
	}
}

function refreshOpponentBar(): void {
	const duel = state.duel;
	if (!duel?.opponent) return;
	const pct = Math.round((duel.opponent.cardsDone / duel.cards.length) * 100);
	const bar = document.getElementById("opp-bar");
	if (bar) bar.style.width = `${pct}%`;
	const done = document.getElementById("opp-done");
	if (done) done.textContent = `${duel.opponent.cardsDone}/${duel.cards.length}`;
}
