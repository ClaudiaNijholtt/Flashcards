import "./styles/main.scss";
import { state } from "./state";
import { shuffle } from "./helpers";
import { renderHome, bindHomeEvents } from "./views/home";
import { renderStudy, bindStudyEvents, startStudy, handleCardClick, markCard, getActiveDeck } from "./views/study";
import { renderDone, bindDoneEvents } from "./views/done";
import { renderGenerating } from "./views/generating";

function render(): void {
	const app = document.getElementById("app")!;
	if (state.isGenerating) {
		app.innerHTML = renderGenerating();
	} else if (state.view === "home") {
		app.innerHTML = renderHome();
		bindHomeEvents(render, (id) => startStudy(id, render));
	} else if (state.view === "study") {
		app.innerHTML = renderStudy();
		bindStudyEvents(render);
	} else if (state.view === "done") {
		app.innerHTML = renderDone();
		bindDoneEvents(render);
	}
}

document.addEventListener("keydown", (e) => {
	const tag = (e.target as HTMLElement).tagName.toLowerCase();
	if (tag === "input" || tag === "textarea") return;
	if (state.view !== "study") return;

	const deck = getActiveDeck();
	if (!deck) return;

	switch (e.key) {
		case " ":
		case "Spacebar":
			e.preventDefault();
			handleCardClick();
			break;
		case "ArrowRight":
			e.preventDefault();
			if (state.cardIndex < deck.cards.length - 1) {
				state.cardIndex++;
				state.flipped = false;
				render();
			}
			break;
		case "ArrowLeft":
			e.preventDefault();
			if (state.cardIndex > 0) {
				state.cardIndex--;
				state.flipped = false;
				render();
			}
			break;
		case "1":
			markCard(false, render);
			break;
		case "2":
			markCard(true, render);
			break;
		case "s":
		case "S":
			deck.cards = shuffle(deck.cards);
			state.cardIndex = 0;
			state.flipped = false;
			state.correct = 0;
			state.wrong = 0;
			state.missed = [];
			render();
			break;
	}
});

render();
