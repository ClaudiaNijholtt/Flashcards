import { state } from "../state";
import { esc } from "../utils/helpers";
import { fetchStudySessions, fetchCardProgressMap } from "../services/srs";
import { isCardDue, cardId } from "../utils/srs-algorithm";
import type { StudySession, CardProgress, Flashcard } from "../types";

interface CardPerfEntry {
	card: Flashcard;
	progress: CardProgress;
}

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
	if (titleEl) titleEl.textContent = deck.name;

	const [sessions, progressMap] = await Promise.all([
		fetchStudySessions(deck.id),
		fetchCardProgressMap(deck.id),
	]);

	const allCardIds = deck.cards.map((c) => cardId(c));
	const dueCount = allCardIds.filter((id) => isCardDue(progressMap.get(id))).length;
	const masteredCount = allCardIds.filter((id) => (progressMap.get(id)?.intervalDays ?? 0) > 21).length;
	const duelCount = state.deckPlayCounts[deck.id] ?? 0;

	// Map card key → Flashcard for lookup
	const cardByKey = new Map<string, Flashcard>();
	for (const card of deck.cards) {
		cardByKey.set(cardId(card), card);
	}

	const progressWithCards: CardPerfEntry[] = [...progressMap.entries()]
		.flatMap(([key, progress]) => {
			const card = cardByKey.get(key);
			return card ? [{ card, progress }] : [];
		});

	// Best: consistently high ease, reviewed ≥2 times
	const bestCards = [...progressWithCards]
		.filter((e) => e.progress.repetitions >= 2)
		.sort((a, b) => b.progress.easeFactor - a.progress.easeFactor)
		.slice(0, 5);

	// Worst: lowest ease factor, reviewed ≥1 time
	const worstCards = [...progressWithCards]
		.filter((e) => e.progress.repetitions >= 1)
		.sort((a, b) => a.progress.easeFactor - b.progress.easeFactor)
		.slice(0, 5);

	const neverStudiedCount = deck.cards.filter((c) => !progressMap.has(cardId(c))).length;

	if (bodyEl) bodyEl.innerHTML = buildStatsHtml(
		sessions, dueCount, masteredCount, duelCount,
		bestCards, worstCards, neverStudiedCount, deck.cards.length,
	);
}

function cardPerfItemHtml(entry: CardPerfEntry): string {
	const q = entry.card.question.length > 60
		? entry.card.question.slice(0, 58) + "…"
		: entry.card.question;
	const reps = entry.progress.repetitions;
	return `
    <div class="stats-perf-item">
      <span class="stats-perf-item__q">${esc(q)}</span>
      <span class="stats-perf-item__reps">${reps}×</span>
    </div>`;
}

function buildStatsHtml(
	sessions: StudySession[],
	dueCount: number,
	masteredCount: number,
	duelCount: number,
	bestCards: CardPerfEntry[],
	worstCards: CardPerfEntry[],
	neverStudiedCount: number,
	totalCards: number,
): string {
	// ── Game overview row ──────────────────────────────────────────────
	const gameOverviewHtml = `
    <div class="stats-game-row">
      <div class="stats-game-item">
        <i data-lucide="layers"></i>
        <span class="stats-game-item__val">${sessions.length}</span>
        <span class="stats-game-item__label">leersessies</span>
      </div>
      <div class="stats-game-item">
        <i data-lucide="swords"></i>
        <span class="stats-game-item__val">${duelCount}</span>
        <span class="stats-game-item__label">duels gespeeld</span>
      </div>
      <div class="stats-game-item stats-game-item--muted">
        <i data-lucide="layout-grid"></i>
        <span class="stats-game-item__val">—</span>
        <span class="stats-game-item__label">quiz (geen data)</span>
      </div>
      <div class="stats-game-item stats-game-item--muted">
        <i data-lucide="grid-2x2"></i>
        <span class="stats-game-item__val">—</span>
        <span class="stats-game-item__label">matchspel (geen data)</span>
      </div>
    </div>`;

	if (sessions.length === 0 && duelCount === 0) {
		return `
      ${gameOverviewHtml}
      <div class="stats-empty">
        <p>Nog geen studeersessies voor dit deck.</p>
        <p>Begin met leren om statistieken bij te houden!</p>
      </div>
    `;
	}

	// ── Card performance section ───────────────────────────────────────
	const hasEnoughData = bestCards.length > 0 || worstCards.length > 0;
	const cardPerfHtml = hasEnoughData ? `
    <h3 class="stats-section-title">Kaartprestaties</h3>
    <div class="stats-perf-grid">
      <div class="stats-perf-col stats-perf-col--good">
        <div class="stats-perf-col__header">
          <i data-lucide="check-circle"></i> Altijd goed
        </div>
        ${bestCards.length > 0
		? bestCards.map(cardPerfItemHtml).join("")
		: `<p class="stats-perf-empty">Nog niet genoeg herhalingen om te bepalen.</p>`}
      </div>
      <div class="stats-perf-col stats-perf-col--bad">
        <div class="stats-perf-col__header">
          <i data-lucide="alert-triangle"></i> Vaakst fout
        </div>
        ${worstCards.length > 0
		? worstCards.map(cardPerfItemHtml).join("")
		: `<p class="stats-perf-empty">Nog geen fouten geregistreerd.</p>`}
      </div>
    </div>
    ${neverStudiedCount > 0 ? `<p class="stats-perf-note">${neverStudiedCount} van de ${totalCards} kaarten nog nooit geoefend.</p>` : ""}
  ` : `
    <h3 class="stats-section-title">Kaartprestaties</h3>
    <p class="stats-perf-note">Oefen dit deck vaker om per-kaart statistieken te zien. ${neverStudiedCount > 0 ? `${neverStudiedCount} kaarten nog nooit geoefend.` : ""}</p>
  `;

	if (sessions.length === 0) {
		return `${gameOverviewHtml}${cardPerfHtml}`;
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
    ${gameOverviewHtml}

    <h3 class="stats-section-title">Leerresultaten</h3>
    <div class="stats-cards">
      <div class="stats-card stats-card--due">
        <div class="stats-card__value">${dueCount}</div>
        <div class="stats-card__label">vandaag te herhalen</div>
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
      <div class="stats-card stats-card--best">
        <div class="stats-card__value">${masteredCount}</div>
        <div class="stats-card__label">gemeisterd</div>
      </div>
    </div>

    <h3 class="stats-section-title">Voortgang (laatste 7 sessies)</h3>
    <div class="stats-chart">
      ${bars}
    </div>

    ${cardPerfHtml}

    <h3 class="stats-section-title">Geschiedenis</h3>
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
