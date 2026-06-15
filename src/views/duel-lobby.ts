import { state } from "../state";
import { esc, showToast } from "../helpers";
import { supabase } from "../supabase";
import { createDuelInDb, fetchDuelByCode, joinDuelInDb } from "../duel-db";
import { duelChannel } from "../duel-channel";

export function renderDuelLobby(): string {
	if (state.duel) {
		return `
      <div class="duel-lobby">
        <button class="btn" id="btn-duel-back">← Terug</button>
        <h2 class="duel-lobby__title">Duel aangemaakt</h2>
        <p class="duel-lobby__sub">Deel deze code met je tegenstander</p>
        <div class="duel-code">${state.duel.code}</div>
        <button class="btn" id="btn-copy-code">Code kopiëren</button>
        <div class="duel-lobby__waiting">
          <div class="duel-lobby__spinner"></div>
          Wachten op tegenstander…
        </div>
        <p class="duel-lobby__deck">Deck: <strong>${esc(state.duel.deckName)}</strong> · ${state.duel.cards.length} kaarten</p>
      </div>
    `;
	}

	return `
    <div class="duel-lobby">
      <button class="btn" id="btn-duel-back">← Terug</button>
      <h2 class="duel-lobby__title">Duel meedoen</h2>
      <p class="duel-lobby__sub">Voer de code van je vriend in</p>
      <div class="duel-join-form">
        <input type="text" id="duel-code-input" placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters" />
        <button class="btn-primary" id="btn-join-duel">Meedoen →</button>
      </div>
      <p id="duel-lobby-error" class="duel-lobby__error hidden"></p>
    </div>
  `;
}

export function bindDuelLobbyEvents(render: () => void): void {
	document.getElementById("btn-duel-back")?.addEventListener("click", () => {
		duelChannel.cleanup();
		state.duel = null;
		state.view = "home";
		render();
	});

	document.getElementById("btn-copy-code")?.addEventListener("click", () => {
		if (!state.duel) return;
		navigator.clipboard.writeText(state.duel.code).then(() => showToast("Code gekopieerd ✓"));
	});

	if (state.duel) {
		waitForOpponent(render);
	} else {
		bindJoinForm(render);
	}
}

function waitForOpponent(render: () => void): void {
	const duel = state.duel!;

	// Use Postgres Changes to detect when guest joins
	const ch = supabase
		.channel("duel-host-wait")
		.on(
			"postgres_changes",
			{ event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${duel.id}` },
			(payload) => {
				const row = payload.new as { guest_id: string | null; status: string };
				if (!row.guest_id || row.status !== "active") return;

				// Switch from Postgres Changes channel to broadcast channel for gameplay
				duelChannel.cleanup();
				const gameCh = supabase.channel(`duel:${duel.code}`).subscribe();
				duelChannel.set(gameCh);

				state.duel!.opponent = { cardsDone: 0, correct: 0, wrong: 0, finished: false, timeMs: 0 };
				state.duel!.startTime = Date.now();
				state.view = "duel-playing";
				render();
			},
		)
		.subscribe();

	duelChannel.set(ch);
}

function bindJoinForm(render: () => void): void {
	const input = document.getElementById("duel-code-input") as HTMLInputElement;

	input?.addEventListener("input", () => {
		input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
	});

	document.getElementById("btn-join-duel")?.addEventListener("click", async () => {
		const code = input?.value.trim();
		if (!code || code.length !== 6) {
			showLobbyError("Voer een geldige 6-teken code in");
			return;
		}

		const btn = document.getElementById("btn-join-duel") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Even wachten…";

		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error("Niet ingelogd");

			const record = await fetchDuelByCode(code);
			if (record.host_id === user.id) throw new Error("Je kunt niet je eigen duel joinen");

			await joinDuelInDb(record.id);

			state.duel = {
				id: record.id,
				code: record.code,
				deckName: record.deck_name,
				cards: record.cards,
				isHost: false,
				cardIndex: 0,
				flipped: false,
				correct: 0,
				wrong: 0,
				selfFinished: false,
				selfTimeMs: 0,
				startTime: Date.now(),
				opponent: { cardsDone: 0, correct: 0, wrong: 0, finished: false, timeMs: 0 },
			};

			const gameCh = supabase.channel(`duel:${record.code}`).subscribe();
			duelChannel.set(gameCh);

			state.view = "duel-playing";
			render();
		} catch (err) {
			showLobbyError(err instanceof Error ? err.message : "Kan niet meedoen");
			btn.disabled = false;
			btn.textContent = "Meedoen →";
		}
	});
}

function showLobbyError(msg: string): void {
	const el = document.getElementById("duel-lobby-error");
	if (el) { el.textContent = msg; el.classList.remove("hidden"); }
}
