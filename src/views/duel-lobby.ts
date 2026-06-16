import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { supabase } from "../services/supabase";
import { fetchProfile } from "../services/profiles";
import { duelChannel } from "../services/realtime";

export function renderDuelLobby(): string {
	const duel = state.duel!;
	return `
    <div class="duel-lobby">
      <button class="btn" id="btn-duel-back"><i data-lucide="arrow-left"></i> Terug</button>
      <h2 class="duel-lobby__title">Duel aangemaakt</h2>
      <p class="duel-lobby__sub">Deel deze code met je tegenstander</p>
      <div class="duel-code">${duel.code}</div>
      <button class="btn" id="btn-copy-code">Code kopiëren</button>
      <div class="duel-lobby__waiting">
        <div class="duel-lobby__spinner"></div>
        Wachten op tegenstander…
      </div>
      <p class="duel-lobby__deck">Deck: <strong>${esc(duel.deckName)}</strong> · ${duel.cards.length} kaarten</p>
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

	waitForOpponent(render);
}

function waitForOpponent(render: () => void): void {
	const duel = state.duel!;

	const ch = supabase
		.channel("duel-host-wait")
		.on(
			"postgres_changes",
			{ event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${duel.id}` },
			async (payload) => {
				const row = payload.new as { guest_id: string | null; status: string };
				if (!row.guest_id || row.status !== "active") return;

				duelChannel.cleanup();
				const gameCh = supabase.channel(`duel:${duel.code}`).subscribe();
				duelChannel.set(gameCh);

				const guestProfile = await fetchProfile(row.guest_id);
				state.duel!.opponent = {
					cardsDone: 0, correct: 0, wrong: 0, finished: false, timeMs: 0,
					name: guestProfile?.username ?? "Tegenstander",
				};
				state.duel!.startTime = Date.now();
				state.view = "duel-playing";
				render();
			},
		)
		.subscribe();

	duelChannel.set(ch);
}
