import { state } from "../state";
import { esc, shuffle } from "../helpers";
import type { Deck } from "../types";

let _shakeHandler: ((e: DeviceMotionEvent) => void) | null = null;
let _shakePermGranted = false;
let _enterFrom: "left" | "right" | null = null;

export function getActiveDeck(): Deck | undefined {
	return state.decks.find((d) => d.id === state.activeDeckId);
}

export function startStudy(deckId: string, render: () => void): void {
	state.activeDeckId = deckId;
	state.view = "study";
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
	const deck = getActiveDeck();
	if (deck) deck.cards = shuffle(deck.cards);
	render();
}

export function renderStudy(): string {
	const deck = getActiveDeck();
	if (!deck) return "";
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
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">Spatie</span> of klik om te draaien</span>
              <span class="hint-mobile">Tik om te draaien &nbsp;·&nbsp; veeg ← →</span>
            </div>
          </div>
          <div class="face back">
            <div class="face__deck">${esc(deck.name)}</div>
            <div class="face__a">${esc(card.answer)}</div>
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het &nbsp; klik om terug</span>
              <span class="hint-mobile">Veeg ← niet &nbsp;·&nbsp; → wel &nbsp;·&nbsp; tik om terug</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mark-row${state.flipped ? " visible" : ""}" id="mark-row">
      <button class="btn-red" id="btn-no"><i data-lucide="x"></i> Wist ik niet</button>
      <button class="btn-green" id="btn-ok"><i data-lucide="check"></i> Wist ik het</button>
    </div>

    <div class="nav-row">
      <button class="btn" id="btn-prev" ${state.cardIndex === 0 ? "disabled" : ""}><i data-lucide="arrow-left"></i> Vorige</button>
      <button class="btn" id="btn-shuffle"><i data-lucide="shuffle"></i> Schudden</button>
      <button class="btn" id="btn-next" ${state.cardIndex === deck.cards.length - 1 ? "disabled" : ""}>Volgende <i data-lucide="arrow-right"></i></button>
    </div>

    <div class="shortcuts" aria-hidden="true">
      <span><span class="kbd">Spatie</span> draaien</span>
      <span><span class="kbd">←</span><span class="kbd">→</span> navigeren</span>
      <span><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het</span>
      <span><span class="kbd">S</span> schudden</span>
    </div>
  `;
}

export function handleCardClick(): void {
	state.flipped = !state.flipped;
	document.getElementById("card")?.classList.toggle("flipped", state.flipped);
	document.getElementById("mark-row")?.classList.toggle("visible", state.flipped);
}

export function markCard(correct: boolean, render: () => void): void {
	if (!state.flipped) return;
	const deck = getActiveDeck();
	if (!deck) return;
	if (correct) {
		state.correct++;
	} else {
		state.wrong++;
		state.missed.push(deck.cards[state.cardIndex]);
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

function doShuffle(render: () => void): void {
	const deck = getActiveDeck();
	if (!deck) return;
	deck.cards = shuffle(deck.cards);
	state.cardIndex = 0;
	state.flipped = false;
	state.correct = 0;
	state.wrong = 0;
	state.missed = [];
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
			doShuffle(render);
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
		// Piggyback on the shuffle button: first tap requests permission, then shake works
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

export function bindStudyEvents(render: () => void): void {
	document.getElementById("btn-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

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
				// Kill any running entry animation so dragging feels instant
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

				// Fly card off screen, then act
				if (cardDrag) {
					cardDrag.style.transition = "transform 0.22s ease-in";
					cardDrag.style.transform = `translateX(${dx > 0 ? 130 : -130}%) rotate(${dx > 0 ? 12 : -12}deg)`;
				}

				setTimeout(() => {
					if (state.flipped) {
						// Right = correct, left = wrong; new card always comes from opposite side
						_enterFrom = dx > 0 ? "left" : "right";
						markCard(dx > 0, render);
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

	document.getElementById("btn-no")?.addEventListener("click", () => markCard(false, render));
	document.getElementById("btn-ok")?.addEventListener("click", () => markCard(true, render));

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
	document.getElementById("btn-shuffle")?.addEventListener("click", () => doShuffle(render));

	setupShake(render);
}
