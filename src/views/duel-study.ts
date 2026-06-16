import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { duelChannel } from "../services/realtime";
import { saveDuelScore } from "../services/duels";

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

	const card = duel.cards[duel.cardIndex];

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

    <div class="scene" id="scene" role="button" tabindex="0" aria-label="Flashcard">
      <div class="card-peek" aria-hidden="true"></div>
      <div class="card-drag" id="card-drag">
        <div class="card-inner${duel.flipped ? " flipped" : ""}" id="card">
          <div class="face front">
            <div class="face__deck">${esc(duel.deckName)}</div>
            <div class="face__q">${esc(card.question)}</div>
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">Spatie</span> of klik om te draaien</span>
              <span class="hint-mobile">Tik om te draaien</span>
            </div>
          </div>
          <div class="face back">
            <div class="face__deck">${esc(duel.deckName)}</div>
            <div class="face__a">${esc(card.answer)}</div>
            <div class="face__hint">
              <span class="hint-desktop"><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het</span>
              <span class="hint-mobile">Veeg ← niet &nbsp;·&nbsp; → wel</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mark-row${duel.flipped ? " visible" : ""}" id="mark-row">
      <button class="btn-red" id="btn-no"><i data-lucide="x"></i> Wist ik niet</button>
      <button class="btn-green" id="btn-ok"><i data-lucide="check"></i> Wist ik het</button>
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

	document.getElementById("scene")?.addEventListener("click", flipDuelCard);
	document.getElementById("btn-ok")?.addEventListener("click", () => void markDuelCard(true, render));
	document.getElementById("btn-no")?.addEventListener("click", () => void markDuelCard(false, render));
}

function flipDuelCard(): void {
	const duel = state.duel;
	if (!duel || duel.selfFinished) return;
	duel.flipped = !duel.flipped;
	document.getElementById("card")?.classList.toggle("flipped", duel.flipped);
	document.getElementById("mark-row")?.classList.toggle("visible", duel.flipped);
}

async function markDuelCard(correct: boolean, render: () => void): Promise<void> {
	const duel = state.duel;
	if (!duel || !duel.flipped || duel.selfFinished) return;

	if (correct) duel.correct++;
	else duel.wrong++;

	const cardsDone = duel.cardIndex + 1;
	const ch = duelChannel.get();

	await ch?.send({
		type: "broadcast",
		event: "duel-progress",
		payload: { cardsDone, correct: duel.correct, wrong: duel.wrong },
	});

	if (duel.cardIndex < duel.cards.length - 1) {
		duel.cardIndex++;
		duel.flipped = false;
		render();
	} else {
		// All cards done
		const timeMs = Date.now() - duel.startTime;
		duel.selfFinished = true;
		duel.selfTimeMs = timeMs;

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
