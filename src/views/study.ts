import { state } from "../state";
import { esc, shuffle, showToast } from "../utils/helpers";
import { cardId, todayIso } from "../utils/srs-algorithm";
import { fetchCardProgressMap } from "../services/srs";
import type { Deck, Flashcard, Quality } from "../types";

let _shakeHandler: ((e: DeviceMotionEvent) => void) | null = null;
let _shakePermGranted = false;
let _enterFrom: "left" | "right" | null = null;

// ── Multiple choice state (stable across re-renders for the same card) ────────
interface MCOption { answer: string; isCorrect: boolean; }
let _mcCardIndex = -1;
let _mcOptions: MCOption[] = [];
let _mcSelected: number | null = null;
let _mcKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function buildMCOptions(cards: Flashcard[], idx: number): MCOption[] {
	const correct = cards[idx].answer;
	const distractors = cards
		.filter((_, i) => i !== idx)
		.map((c) => c.answer)
		.sort(() => Math.random() - 0.5)
		.slice(0, 3);
	return [
		{ answer: correct, isCorrect: true },
		...distractors.map((a) => ({ answer: a, isCorrect: false })),
	].sort(() => Math.random() - 0.5);
}

function mcOptionClass(i: number): string {
	if (_mcSelected === null) return "";
	if (_mcOptions[i].isCorrect) return " duel-option--correct";
	if (i === _mcSelected) return " duel-option--wrong";
	return " duel-option--neutral";
}

export function getActiveDeck(): Deck | undefined {
	const deck = state.decks.find((d) => d.id === state.activeDeckId);
	if (state.studyCards !== null && !deck && state.mixStudyName) {
		return { id: "mix", name: state.mixStudyName, cards: state.studyCards, createdAt: new Date() };
	}
	if (!deck) return undefined;
	if (state.studyCards !== null) return { ...deck, cards: state.studyCards };
	return deck;
}

export function startStudy(deckId: string, render: () => void): void {
	const deck = state.decks.find((d) => d.id === deckId);
	state.activeDeckId = deckId;
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
	state.cardQualities = {};
	state.studyStartTime = 0;
	state.lastCardSnapshot = null;
	state.studyCards = deck ? shuffle([...deck.cards]) : null;
	state.view = "study-mode-pick";
	render();
}

export async function startDueStudy(deckId: string, render: () => void): Promise<void> {
	const deck = state.decks.find((d) => d.id === deckId);
	if (!deck) return;
	const progressMap = await fetchCardProgressMap(deckId);
	const today = todayIso();
	const dueCards = deck.cards.filter((c) => {
		const p = progressMap.get(cardId(c));
		return !p || p.dueDate <= today;
	});
	if (dueCards.length === 0) {
		showToast("Alle kaarten al geleerd vandaag!");
		return;
	}
	state.activeDeckId = deckId;
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
	state.cardQualities = {};
	state.studyStartTime = 0;
	state.lastCardSnapshot = null;
	state.studyCards = shuffle([...dueCards]);
	state.view = "study-mode-pick";
	render();
}

export function renderStudy(): string {
	const deck = getActiveDeck();
	if (!deck) return "";
	if (state.studyMode === "multiple-choice") return renderStudyMC(deck);
	if (state.studyMode === "type-answer") return renderStudyTypeAnswer(deck);
	return renderStudyFlashcard(deck);
}

function renderStudyFlashcard(deck: Deck): string {
	const card = deck.cards[state.cardIndex];
	const pct = Math.round((state.cardIndex / deck.cards.length) * 100);
	const enterClass = _enterFrom ? ` card-drag--enter-${_enterFrom}` : "";
	_enterFrom = null;

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="study-header__title">${esc(deck.name)}</div>
    </div>

    <div class="progress-row">
      <span>${state.cardIndex + 1} / ${deck.cards.length}</span>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="score-row">
        <span class="ok"><i data-lucide="check"></i> ${state.correct}</span>
        <span class="no"><i data-lucide="x"></i> ${state.wrong}</span>
      </div>
    </div>

    <div class="scene" id="scene" role="button" tabindex="0" aria-label="Flashcard">
      <div class="card-peek" id="card-peek" aria-hidden="true"></div>
      <div class="card-drag${enterClass}" id="card-drag">
        <div class="card-inner${state.flipped ? " flipped" : ""}" id="card">
          <div class="face front">
            <div class="face__deck">${esc(deck.name)}</div>
            <div class="face__q">${esc(card.question)}</div>
            ${card.imageUrl ? `<img class="card-study-image" src="${esc(card.imageUrl)}" alt="" loading="lazy">` : ""}
            ${card.audioUrl ? `<div class="card-audio-wrap"><button class="btn-icon card-audio-play-btn" data-audio-url="${esc(card.audioUrl)}" title="Afspelen"><i data-lucide="volume-2"></i></button></div>` : ""}
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">Spatie</span> of klik om te draaien</span>
              <span class="hint-mobile">Tik om te draaien &nbsp;·&nbsp; veeg ← →</span>
            </div>
          </div>
          <div class="face back">
            <div class="face__deck">${esc(deck.name)}</div>
            <div class="face__a">${esc(card.answer)}</div>
            ${card.imageUrl ? `<img class="card-study-image" src="${esc(card.imageUrl)}" alt="" loading="lazy">` : ""}
            ${card.audioUrl ? `<div class="card-audio-wrap"><button class="btn-icon card-audio-play-btn" data-audio-url="${esc(card.audioUrl)}" title="Afspelen"><i data-lucide="volume-2"></i></button></div>` : ""}
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">1</span> niet &nbsp;<span class="kbd">2</span> twijfel &nbsp;<span class="kbd">3</span> geweten</span>
              <span class="hint-mobile">Veeg ← niet &nbsp;·&nbsp; → geweten &nbsp;·&nbsp; tik om terug</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mark-row mark-row--three${state.flipped ? " visible" : ""}" id="mark-row">
      <button class="btn-red" id="btn-no"><i data-lucide="x"></i> Wist ik niet</button>
      <button class="btn-doubt" id="btn-doubt"><i data-lucide="minus"></i> Twijfel</button>
      <button class="btn-green" id="btn-ok"><i data-lucide="check"></i> Wist ik het</button>
    </div>

    <div class="nav-row">
      <button class="btn" id="btn-prev" ${state.cardIndex === 0 ? "disabled" : ""} title="Vorige"><i data-lucide="arrow-left"></i><span class="nav-label"> Vorige</span></button>
      <button class="btn" id="btn-shuffle" title="Schudden"><i data-lucide="shuffle"></i><span class="nav-label"> Schudden</span></button>
      <button class="btn" id="btn-undo" ${!state.lastCardSnapshot ? "disabled" : ""} title="Ongedaan maken"><i data-lucide="rotate-ccw"></i><span class="nav-label"> Ongedaan</span></button>
      <button class="btn" id="btn-next" ${state.cardIndex === deck.cards.length - 1 ? "disabled" : ""} title="Volgende"><span class="nav-label">Volgende </span><i data-lucide="arrow-right"></i></button>
    </div>

    <div class="shortcuts" aria-hidden="true">
      <span><span class="kbd">Spatie</span> draaien</span>
      <span><span class="kbd">←</span><span class="kbd">→</span> navigeren</span>
      <span><span class="kbd">1</span> niet &nbsp;<span class="kbd">2</span> twijfel &nbsp;<span class="kbd">3</span> geweten</span>
      <span><span class="kbd">S</span> schudden</span>
      <span><span class="kbd">U</span> ongedaan</span>
    </div>
  `;
}

function renderStudyMC(deck: Deck): string {
	if (state.cardIndex !== _mcCardIndex) {
		_mcCardIndex = state.cardIndex;
		_mcSelected = null;
		_mcOptions = buildMCOptions(deck.cards, state.cardIndex);
	}

	const card = deck.cards[state.cardIndex];
	const pct = Math.round((state.cardIndex / deck.cards.length) * 100);
	const answered = _mcSelected !== null;
	const letters = ["A", "B", "C", "D"];

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="study-header__title">${esc(deck.name)}</div>
    </div>

    <div class="progress-row">
      <span>${state.cardIndex + 1} / ${deck.cards.length}</span>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="score-row">
        <span class="ok"><i data-lucide="check"></i> ${state.correct}</span>
        <span class="no"><i data-lucide="x"></i> ${state.wrong}</span>
      </div>
    </div>

    <div class="duel-question-card">
      <div class="duel-question-card__deck">${esc(deck.name)}</div>
      <div class="duel-question-card__q">${esc(card.question)}</div>
      ${card.imageUrl ? `<img class="card-study-image" src="${esc(card.imageUrl)}" alt="" loading="lazy">` : ""}
      ${!answered ? `<div class="duel-question-card__hint">Kies het juiste antwoord</div>` : ""}
    </div>

    <div class="duel-options${answered ? " duel-options--answered" : ""}">
      ${_mcOptions.map((opt, i) => `
        <button class="duel-option${mcOptionClass(i)}" data-idx="${i}" ${answered ? "disabled" : ""}>
          <span class="duel-option__letter">${letters[i]}</span>
          <span class="duel-option__text">${esc(opt.answer)}</span>
        </button>
      `).join("")}
    </div>

    <div class="mark-row${answered ? " visible" : ""}" id="next-row">
      <button class="btn-primary" id="btn-next-mc">
        ${state.cardIndex < deck.cards.length - 1
			? `Volgende <i data-lucide="arrow-right"></i>`
			: `Klaar <i data-lucide="check"></i>`}
      </button>
    </div>
  `;
}

function bindStudyMCEvents(render: () => void): void {
	document.querySelectorAll<HTMLButtonElement>(".duel-option").forEach((btn) => {
		btn.addEventListener("click", () => selectMCOption(Number(btn.dataset.idx), render));
	});

	document.getElementById("btn-next-mc")?.addEventListener("click", () => advanceMC(render));

	if (_mcKeyHandler) document.removeEventListener("keydown", _mcKeyHandler);
	_mcKeyHandler = (e: KeyboardEvent) => {
		if (state.view !== "study" || state.studyMode !== "multiple-choice") {
			document.removeEventListener("keydown", _mcKeyHandler!);
			_mcKeyHandler = null;
			return;
		}
		const tag = (e.target as HTMLElement).tagName.toLowerCase();
		if (tag === "input" || tag === "textarea") return;

		if (_mcSelected === null) {
			const idx = ["1", "2", "3", "4"].indexOf(e.key);
			if (idx !== -1 && idx < _mcOptions.length) {
				e.preventDefault();
				selectMCOption(idx, render);
			}
		} else if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
			e.preventDefault();
			advanceMC(render);
		}
	};
	document.addEventListener("keydown", _mcKeyHandler);
}

function selectMCOption(idx: number, render: () => void): void {
	if (_mcSelected !== null || idx >= _mcOptions.length) return;
	_mcSelected = idx;

	const deck = getActiveDeck();
	if (!deck) return;
	const card = deck.cards[state.cardIndex];
	const cid = cardId(card);
	const correct = _mcOptions[idx].isCorrect;

	// quality 2 if correct, 0 if wrong — no "twijfel" for MC
	const quality: Quality = correct ? 2 : 0;
	state.cardQualities[cid] = quality;
	if (correct) state.correct++;
	else { state.wrong++; state.missed.push(card); }

	render();
}

function advanceMC(render: () => void): void {
	if (_mcSelected === null) return;
	const deck = getActiveDeck();
	if (!deck) return;

	if (state.cardIndex < deck.cards.length - 1) {
		state.cardIndex++;
		state.flipped = false;
		render();
	} else {
		state.view = "done";
		render();
	}
}

export function handleCardClick(): void {
	state.flipped = !state.flipped;
	document.getElementById("card")?.classList.toggle("flipped", state.flipped);
	document.getElementById("mark-row")?.classList.toggle("visible", state.flipped);
}

export function markCard(quality: Quality, render: () => void): void {
	if (!state.flipped) return;
	const deck = getActiveDeck();
	if (!deck) return;

	// Save snapshot so the user can undo this rating
	state.lastCardSnapshot = {
		cardIndex: state.cardIndex,
		correct: state.correct,
		wrong: state.wrong,
		missed: [...state.missed],
		qualities: { ...state.cardQualities },
	};

	const card = deck.cards[state.cardIndex];
	const cid = cardId(card);
	state.cardQualities[cid] = quality;

	if (quality === 2) {
		state.correct++;
	} else {
		state.wrong++;
		state.missed.push(card);
	}

	if (state.cardIndex < deck.cards.length - 1) {
		state.cardIndex++;
		state.flipped = false;
		render();
	} else {
		state.view = "done";
		render();
	}
}

export function undoLastCard(render: () => void): void {
	const snap = state.lastCardSnapshot;
	if (!snap) return;
	state.cardIndex = snap.cardIndex;
	state.correct = snap.correct;
	state.wrong = snap.wrong;
	state.missed = snap.missed;
	state.cardQualities = snap.qualities;
	state.flipped = false;
	state.lastCardSnapshot = null;
	render();
}

export function reshuffleStudy(render: () => void): void {
	const deck = state.decks.find((d) => d.id === state.activeDeckId);
	if (!deck) return;
	state.studyCards = shuffle([...deck.cards]);
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
	state.cardQualities = {};
	state.studyStartTime = Date.now();
	render();
}

function attachShakeListener(render: () => void): void {
	if (_shakeHandler) return;
	let lastShake = 0;
	_shakeHandler = (e: DeviceMotionEvent) => {
		const acc = e.accelerationIncludingGravity;
		if (!acc) return;
		const mag = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
		const now = Date.now();
		if (mag > 15 && now - lastShake > 1000) {
			lastShake = now;
			reshuffleStudy(render);
		}
	};
	window.addEventListener("devicemotion", _shakeHandler);
}

function setupShake(render: () => void): void {
	if (typeof DeviceMotionEvent === "undefined") return;
	if (_shakeHandler) return;

	// @ts-expect-error — iOS 13+ requires explicit permission from a user gesture
	if (typeof DeviceMotionEvent.requestPermission === "function") {
		if (_shakePermGranted) {
			attachShakeListener(render);
			return;
		}
		document.getElementById("btn-shuffle")?.addEventListener(
			"click",
			() => {
				// @ts-expect-error
				DeviceMotionEvent.requestPermission()
					.then((result: string) => {
						if (result === "granted") {
							_shakePermGranted = true;
							attachShakeListener(render);
						}
					})
					.catch(() => {});
			},
			{ once: true },
		);
	} else {
		attachShakeListener(render);
	}
}

export function cleanupShake(): void {
	if (_shakeHandler) {
		window.removeEventListener("devicemotion", _shakeHandler);
		_shakeHandler = null;
	}
}

function normalize(s: string): string {
	return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function renderStudyTypeAnswer(deck: Deck): string {
	const card = deck.cards[state.cardIndex];
	const pct = Math.round((state.cardIndex / deck.cards.length) * 100);

	return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-back"><i data-lucide="arrow-left"></i> Terug</button>
      <div class="study-header__title">${esc(deck.name)}</div>
    </div>

    <div class="progress-row">
      <span>${state.cardIndex + 1} / ${deck.cards.length}</span>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="score-row">
        <span class="ok"><i data-lucide="check"></i> ${state.correct}</span>
        <span class="no"><i data-lucide="x"></i> ${state.wrong}</span>
      </div>
    </div>

    <div class="duel-question-card">
      <div class="duel-question-card__deck">${esc(deck.name)}</div>
      <div class="duel-question-card__q">${esc(card.question)}</div>
    </div>

    <div class="type-answer-wrap">
      <input
        type="text"
        id="type-answer-input"
        class="type-answer-input"
        placeholder="Jouw antwoord…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      <div class="mark-row" style="margin-top:0.75rem">
        <button class="btn-primary" id="btn-type-submit">Controleer <i data-lucide="arrow-right"></i></button>
      </div>

      <div id="type-answer-result" class="type-answer-result" style="display:none">
        <div class="type-answer-result__label" id="type-answer-verdict"></div>
        <div class="type-answer-result__answer" id="type-answer-correct"></div>
        <div class="mark-row" style="margin-top:0.75rem">
          <button class="btn-primary" id="btn-type-next">
            ${state.cardIndex < deck.cards.length - 1
				? `Volgende <i data-lucide="arrow-right"></i>`
				: `Klaar <i data-lucide="check"></i>`}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function bindStudyTypeAnswerEvents(render: () => void): void {
	document.getElementById("btn-back")?.addEventListener("click", () => {
		state.view = "study-mode-pick";
		render();
	});

	const input = document.getElementById("type-answer-input") as HTMLInputElement | null;
	input?.focus();

	function submit(): void {
		const deck = getActiveDeck();
		if (!deck) return;
		const card = deck.cards[state.cardIndex];
		const typed = (document.getElementById("type-answer-input") as HTMLInputElement)?.value ?? "";
		const correct = normalize(typed) === normalize(card.answer);
		const quality: Quality = correct ? 2 : 0;

		const resultEl = document.getElementById("type-answer-result");
		const submitBtn = document.getElementById("btn-type-submit");
		const verdictEl = document.getElementById("type-answer-verdict");
		const correctEl = document.getElementById("type-answer-correct");

		if (resultEl) {
			resultEl.style.display = "block";
			resultEl.className = `type-answer-result type-answer-result--${correct ? "correct" : "wrong"}`;
		}
		if (submitBtn) submitBtn.style.display = "none";
		if (verdictEl) verdictEl.textContent = correct ? "✓ Correct!" : "✗ Fout";
		if (correctEl) correctEl.textContent = correct ? typed : `Juist antwoord: ${card.answer}`;

		document.getElementById("btn-type-next")?.addEventListener("click", () => {
			state.flipped = true;
			markCard(quality, render);
		});
	}

	document.getElementById("btn-type-submit")?.addEventListener("click", submit);

	input?.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submit();
		}
	});
}

export function bindStudyEvents(render: () => void): void {
	document.getElementById("btn-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	if (state.studyMode === "multiple-choice") {
		bindStudyMCEvents(render);
		return;
	}

	const scene = document.getElementById("scene");
	if (scene) {
		let startX = 0;
		let startY = 0;
		let swipeHandled = false;

		scene.addEventListener(
			"touchstart",
			(e) => {
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
				swipeHandled = false;
				const cardDrag = document.getElementById("card-drag");
				if (cardDrag) {
					cardDrag.classList.remove("card-drag--enter-left", "card-drag--enter-right");
					cardDrag.style.transition = "none";
				}
				const cardPeek = document.getElementById("card-peek");
				if (cardPeek) cardPeek.style.transition = "none";
			},
			{ passive: true },
		);

		scene.addEventListener(
			"touchmove",
			(e) => {
				const dx = e.touches[0].clientX - startX;
				const dy = Math.abs(e.touches[0].clientY - startY);
				if (Math.abs(dx) > dy && Math.abs(dx) > 10) {
					e.preventDefault();
					const cardDrag = document.getElementById("card-drag");
					if (cardDrag) {
						cardDrag.style.transform = `translateX(${dx}px) rotate(${dx * 0.04}deg)`;
					}
					const cardPeek = document.getElementById("card-peek");
					if (cardPeek) {
						const p = Math.min(Math.abs(dx) / 150, 1);
						cardPeek.style.transform = `scale(${0.96 + 0.04 * p}) translateY(${6 - 6 * p}px)`;
					}
				}
			},
			{ passive: false },
		);

		scene.addEventListener(
			"touchend",
			(e) => {
				const dx = e.changedTouches[0].clientX - startX;
				const dy = e.changedTouches[0].clientY - startY;
				const isSwipe = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5;

				const cardDrag = document.getElementById("card-drag");
				const cardPeek = document.getElementById("card-peek");
				const snapBack = () => {
					if (cardDrag) {
						cardDrag.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
						cardDrag.style.transform = "";
					}
					if (cardPeek) {
						cardPeek.style.transition = "transform 0.35s ease";
						cardPeek.style.transform = "";
					}
				};

				if (!isSwipe) {
					snapBack();
					return;
				}

				const deck = getActiveDeck();
				const canAct =
					deck &&
					(state.flipped ||
						(dx < 0 && state.cardIndex < deck.cards.length - 1) ||
						(dx > 0 && state.cardIndex > 0));

				if (!canAct) {
					snapBack();
					return;
				}

				swipeHandled = true;

				if (cardDrag) {
					cardDrag.style.transition = "transform 0.22s ease-in";
					cardDrag.style.transform = `translateX(${dx > 0 ? 130 : -130}%) rotate(${dx > 0 ? 12 : -12}deg)`;
				}

				setTimeout(() => {
					if (state.flipped) {
						// Swipe right = geweten (2), swipe left = wist het niet (0)
						_enterFrom = dx > 0 ? "left" : "right";
						markCard(dx > 0 ? 2 : 0, render);
					} else if (dx < 0) {
						_enterFrom = "right";
						state.cardIndex++;
						state.flipped = false;
						render();
					} else {
						_enterFrom = "left";
						state.cardIndex--;
						state.flipped = false;
						render();
					}
				}, 210);
			},
			{ passive: true },
		);

		scene.addEventListener("click", () => {
			if (swipeHandled) {
				swipeHandled = false;
				return;
			}
			handleCardClick();
		});
	}

	document.getElementById("btn-no")?.addEventListener("click", () => markCard(0, render));
	document.getElementById("btn-doubt")?.addEventListener("click", () => markCard(1, render));
	document.getElementById("btn-ok")?.addEventListener("click", () => markCard(2, render));

	document.getElementById("btn-prev")?.addEventListener("click", () => {
		if (state.cardIndex > 0) {
			state.cardIndex--;
			state.flipped = false;
			render();
		}
	});
	document.getElementById("btn-next")?.addEventListener("click", () => {
		const deck = getActiveDeck();
		if (deck && state.cardIndex < deck.cards.length - 1) {
			state.cardIndex++;
			state.flipped = false;
			render();
		}
	});
	document.getElementById("btn-shuffle")?.addEventListener("click", () => reshuffleStudy(render));
	document.getElementById("btn-undo")?.addEventListener("click", () => undoLastCard(render));

	setupShake(render);

	document.querySelectorAll<HTMLElement>(".card-audio-play-btn").forEach(btn => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const url = btn.dataset.audioUrl!;
			const audio = new Audio(url);
			audio.play().catch(() => showToast("Audio afspelen mislukt", true));
		});
	});
}
