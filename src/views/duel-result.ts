import { state } from "../state";
import { esc } from "../helpers";
import { duelChannel } from "../duel-channel";

function formatTime(ms: number): string {
	const s = Math.round(ms / 1000);
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function renderDuelResult(): string {
	const duel = state.duel!;
	const opp = duel.opponent!;
	const total = duel.cards.length;

	let verdict: string;
	if (duel.correct > opp.correct) {
		verdict = "🏆 Jij gewonnen!";
	} else if (opp.correct > duel.correct) {
		verdict = "Tegenstander gewonnen";
	} else if (duel.selfTimeMs < opp.timeMs) {
		verdict = "🏆 Jij gewonnen! (sneller)";
	} else if (opp.timeMs < duel.selfTimeMs) {
		verdict = "Tegenstander gewonnen (sneller)";
	} else {
		verdict = "Gelijkspel!";
	}

	return `
    <div class="duel-result">
      <div class="duel-result__verdict">${verdict}</div>

      <div class="duel-result__scores">
        <div class="duel-result__col">
          <div class="duel-result__player">${esc(duel.selfName)}</div>
          <div class="duel-result__stat ok"><i data-lucide="check"></i> ${duel.correct} / ${total}</div>
          <div class="duel-result__stat no"><i data-lucide="x"></i> ${duel.wrong}</div>
          <div class="duel-result__time">${formatTime(duel.selfTimeMs)}</div>
        </div>
        <div class="duel-result__divider">VS</div>
        <div class="duel-result__col">
          <div class="duel-result__player">${esc(opp.name)}</div>
          <div class="duel-result__stat ok"><i data-lucide="check"></i> ${opp.correct} / ${total}</div>
          <div class="duel-result__stat no"><i data-lucide="x"></i> ${opp.wrong}</div>
          <div class="duel-result__time">${formatTime(opp.timeMs)}</div>
        </div>
      </div>

      <div class="duel-result__btns">
        <button class="btn" id="btn-duel-home"><i data-lucide="arrow-left"></i> Home</button>
      </div>
    </div>
  `;
}

export function bindDuelResultEvents(render: () => void): void {
	document.getElementById("btn-duel-home")?.addEventListener("click", () => {
		duelChannel.cleanup();
		state.duel = null;
		state.view = "home";
		render();
	});
}
