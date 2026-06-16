import { state } from "../state";
import { esc } from "../utils/helpers";
import { fetchStudySessions, fetchCardProgressMap } from "../services/srs";
import { isCardDue, cardId } from "../utils/srs-algorithm";
import type { StudySession } from "../types";

export function renderStats(): string {
	return `
    <div class="stats-view">
      <button class="btn" id="btn-stats-back"><i data-lucide="arrow-left"></i> Terug</button>
      <h2 id="stats-title">Statistieken laden…</h2>
      <div id="stats-body"><div class="stats-loading"><div class="duel-lobby__spinner"></div></div></div>
    </div>
  `;
}

export function bindStatsEvents(render: () => void): void {
	document.getElementById("btn-stats-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	void loadStats();
}

async function loadStats(): Promise<void> {
	const deck = state.decks.find((d) => d.id === state.activeDeckId);
	if (!deck) return;

	const titleEl = document.getElementById("stats-title");
	const bodyEl = document.getElementById("stats-body");
	if (titleEl) titleEl.textContent = esc(deck.name);

	const [sessions, progressMap] = await Promise.all([
		fetchStudySessions(deck.id),
		fetchCardProgressMap(deck.id),
	]);

	const cardIds = deck.cards.map((c) => cardId(c));
	const dueCount = cardIds.filter((id) => isCardDue(progressMap.get(id))).length;

	if (bodyEl) bodyEl.innerHTML = buildStatsHtml(sessions, dueCount, deck.cards.length);
}

function buildStatsHtml(sessions: StudySession[], dueCount: number, totalCards: number): string {
	if (sessions.length === 0) {
		return `
      <div class="stats-empty">
        <p>Nog geen studeersessies voor dit deck.</p>
        <p>Begin met leren om statistieken bij te houden!</p>
      </div>
    `;
	}

	const avgPct = Math.round(sessions.reduce((s, r) => s + (r.correct / r.cardsStudied) * 100, 0) / sessions.length);
	const bestPct = Math.max(...sessions.map((r) => Math.round((r.correct / r.cardsStudied) * 100)));
	const totalStudied = sessions.reduce((s, r) => s + r.cardsStudied, 0);

	// Bar chart for last 7 sessions (most recent last)
	const chartSessions = [...sessions].reverse().slice(-7);
	const bars = chartSessions
		.map((s) => {
			const pct = Math.round((s.correct / s.cardsStudied) * 100);
			const date = s.studiedAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
			return `
        <div class="stats-bar-col">
          <div class="stats-bar-wrap">
            <div class="stats-bar" style="height:${pct}%" title="${pct}%">
              <span class="stats-bar__label">${pct}%</span>
            </div>
          </div>
          <div class="stats-bar-date">${date}</div>
        </div>
      `;
		})
		.join("");

	return `
    <div class="stats-cards">
      <div class="stats-card stats-card--due">
        <div class="stats-card__value">${dueCount}</div>
        <div class="stats-card__label">vandaag te herhalen</div>
      </div>
      <div class="stats-card">
        <div class="stats-card__value">${sessions.length}</div>
        <div class="stats-card__label">sessies totaal</div>
      </div>
      <div class="stats-card stats-card--good">
        <div class="stats-card__value">${avgPct}%</div>
        <div class="stats-card__label">gemiddeld goed</div>
      </div>
      <div class="stats-card stats-card--best">
        <div class="stats-card__value">${bestPct}%</div>
        <div class="stats-card__label">beste sessie</div>
      </div>
      <div class="stats-card">
        <div class="stats-card__value">${totalStudied}</div>
        <div class="stats-card__label">kaarten geoefend</div>
      </div>
      <div class="stats-card">
        <div class="stats-card__value">${totalCards}</div>
        <div class="stats-card__label">kaarten in deck</div>
      </div>
    </div>

    <h3 class="stats-chart-title">Voortgang (laatste 7 sessies)</h3>
    <div class="stats-chart">
      ${bars}
    </div>

    <h3 class="stats-history-title">Geschiedenis</h3>
    <div class="stats-history">
      ${sessions.map((s) => {
		const pct = Math.round((s.correct / s.cardsStudied) * 100);
		const date = s.studiedAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
		const dur = s.durationMs < 60000
			? `${Math.round(s.durationMs / 1000)}s`
			: `${Math.floor(s.durationMs / 60000)}m ${Math.round((s.durationMs % 60000) / 1000)}s`;
		return `
          <div class="stats-row">
            <span class="stats-row__date">${date}</span>
            <span class="stats-row__score ${pct >= 80 ? "ok" : pct >= 50 ? "doubt" : "no"}">${pct}%</span>
            <span class="stats-row__detail">${s.correct}/${s.cardsStudied} goed · ${dur}</span>
          </div>
        `;
	}).join("")}
    </div>
  `;
}
