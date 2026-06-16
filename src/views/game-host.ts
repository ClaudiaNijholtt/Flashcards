import { state } from "../state";
import { esc } from "../utils/helpers";
import { showToast } from "../utils/helpers";
import {
  startQuizGame,
  advanceQuizQuestion,
  fetchAnswersForQuestion,
  updatePlayerScores,
  fetchQuizPlayers,
  subscribeToQuizSession,
} from "../services/game";
import { quizChannel } from "../services/realtime";
import type { QuizSessionRow } from "../services/game";
import type { QuizPlayer, QuizAnswer } from "../types";

let _timer: ReturnType<typeof setInterval> | null = null;

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = ["#e74c3c", "#3498db", "#f39c12", "#2ecc71"];

export function renderQuizHost(): string {
  const quiz = state.quiz!;

  if (quiz.phase === "lobby") {
    const playerItems = quiz.players
      .map((p) => `<div class="quiz-player-card"><span class="quiz-player-card__name">${esc(p.nickname)}</span></div>`)
      .join("");

    return `
      <div class="quiz-layout">
        <div class="quiz-lobby">
          <div class="quiz-lobby__header">
            <h2>Quiz lobby</h2>
            <p class="quiz-lobby__deck">${esc(quiz.deckName)}</p>
          </div>
          <div class="quiz-lobby__code-wrap">
            <p class="quiz-lobby__code-label">Spelcode</p>
            <div class="quiz-code-display">${esc(quiz.sessionId)}</div>
            <p class="quiz-lobby__code-hint">Deel deze code met spelers</p>
          </div>
          <div class="quiz-lobby__players">
            <p class="quiz-lobby__players-title">Spelers (${quiz.players.length})</p>
            <div class="quiz-player-list">
              ${playerItems || `<p class="quiz-lobby__waiting">Wachten op spelers…</p>`}
            </div>
          </div>
          <button class="btn-primary quiz-lobby__start" id="btn-quiz-start" ${quiz.players.length === 0 ? "disabled" : ""}>
            Starten
          </button>
          <button class="btn quiz-back" id="btn-quiz-back">Annuleren</button>
        </div>
      </div>`;
  }

  if (quiz.phase === "question") {
    const q = quiz.questions[quiz.currentQuestion];
    const elapsed = Date.now() - quiz.questionStartedAt;
    const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
    const answeredCount = quiz.currentAnswers.length;
    const totalPlayers = quiz.players.length;

    const optionsHtml = q.options
      .map((opt, i) => `
        <button class="quiz-option quiz-option--${OPTION_LABELS[i].toLowerCase()}" disabled>
          <span class="quiz-option__label">${OPTION_LABELS[i]}</span>
          <span class="quiz-option__text">${esc(opt)}</span>
        </button>`)
      .join("");

    return `
      <div class="quiz-layout">
        <div class="quiz-question-header">
          <span class="quiz-question-num">Vraag ${quiz.currentQuestion + 1} / ${quiz.questions.length}</span>
          <span class="quiz-timer${remaining < 5 ? " quiz-timer--urgent" : ""}" id="quiz-timer">${remaining}</span>
        </div>
        <div class="quiz-question-text">${esc(q.question)}</div>
        <div class="quiz-options">${optionsHtml}</div>
        <div class="answer-count" id="answer-count">${answeredCount} / ${totalPlayers} spelers beantwoord</div>
        <button class="btn-primary" id="btn-reveal-results" style="margin-top:1rem">Resultaten tonen</button>
        <button class="btn quiz-back" id="btn-quiz-back">Stoppen</button>
      </div>`;
  }

  if (quiz.phase === "after-question") {
    const q = quiz.questions[quiz.currentQuestion];
    const totalPlayers = quiz.players.length;
    const isLast = quiz.currentQuestion >= quiz.questions.length - 1;

    const optionsHtml = q.options
      .map((opt, i) => {
        const isCorrect = opt === q.correctAnswer;
        const answerers = quiz.currentAnswers.filter((a) => a.chosenAnswer === opt);
        const mod = isCorrect ? "quiz-option--correct" : "quiz-option--wrong";
        return `
          <div class="quiz-option quiz-option--${OPTION_LABELS[i].toLowerCase()} ${mod}" data-count="${answerers.length}">
            <span class="quiz-option__label">${OPTION_LABELS[i]}</span>
            <span class="quiz-option__text">${esc(opt)}</span>
            <span class="quiz-option__count">${answerers.length} / ${totalPlayers}</span>
          </div>`;
      })
      .join("");

    const leaderboard = [...quiz.players]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((p, i) => `
        <div class="quiz-leaderboard-row">
          <span class="quiz-leaderboard-row__rank">${i + 1}</span>
          <span class="quiz-leaderboard-row__name">${esc(p.nickname)}</span>
          <span class="quiz-leaderboard-row__score">${p.score} pts</span>
        </div>`)
      .join("");

    return `
      <div class="quiz-layout">
        <div class="quiz-question-header">
          <span class="quiz-question-num">Vraag ${quiz.currentQuestion + 1} / ${quiz.questions.length} — resultaten</span>
        </div>
        <div class="quiz-correct-answer">
          <span class="quiz-correct-answer__label">Correct antwoord:</span>
          <span class="quiz-correct-answer__text">${esc(q.correctAnswer)}</span>
        </div>
        <div class="quiz-options quiz-options--results">${optionsHtml}</div>
        <div class="quiz-leaderboard">
          <p class="quiz-leaderboard__title">Tussenstand</p>
          ${leaderboard}
        </div>
        <button class="btn-primary" id="btn-next-question">
          ${isLast ? "Eindstand bekijken" : "Volgende vraag"}
        </button>
        <button class="btn quiz-back" id="btn-quiz-back">Stoppen</button>
      </div>`;
  }

  if (quiz.phase === "final") {
    const sorted = [...quiz.players].sort((a, b) => b.score - a.score);
    const leaderboard = sorted
      .map((p, i) => `
        <div class="quiz-leaderboard-row">
          <span class="quiz-leaderboard-row__rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <span class="quiz-leaderboard-row__name">${esc(p.nickname)}</span>
          <span class="quiz-leaderboard-row__score">${p.score} pts</span>
        </div>`)
      .join("");

    return `
      <div class="quiz-layout">
        <div class="quiz-final">
          <h2 class="quiz-final__title">Eindstand</h2>
          <p class="quiz-final__deck">${esc(quiz.deckName)}</p>
          <div class="quiz-leaderboard quiz-leaderboard--final">
            ${leaderboard}
          </div>
          <button class="btn-primary" id="btn-quiz-home">Terug naar home</button>
        </div>
      </div>`;
  }

  return "";
}

export function bindQuizHostEvents(render: () => void): void {
  const quiz = state.quiz!;

  // Set up realtime subscription
  const channel = subscribeToQuizSession(
    quiz.sessionId,
    (session: QuizSessionRow) => {
      if (!state.quiz) return;

      if (session.status === "playing") {
        if (state.quiz.phase === "lobby") {
          state.quiz.phase = "question";
          state.quiz.currentQuestion = session.current_question;
          state.quiz.questionStartedAt = session.question_started_at
            ? new Date(session.question_started_at).getTime()
            : Date.now();
          state.quiz.currentAnswers = [];
          state.quiz.hasAnsweredCurrent = false;
          render();
          startTimer(render);
        } else if (session.current_question !== state.quiz.currentQuestion) {
          // New question
          state.quiz.currentQuestion = session.current_question;
          state.quiz.questionStartedAt = session.question_started_at
            ? new Date(session.question_started_at).getTime()
            : Date.now();
          state.quiz.currentAnswers = [];
          state.quiz.hasAnsweredCurrent = false;
          state.quiz.phase = "question";
          render();
          startTimer(render);
        }
      } else if (session.status === "finished") {
        stopTimer();
        state.quiz.phase = "final";
        render();
      }
    },
    (player: QuizPlayer) => {
      if (!state.quiz) return;
      // Check for duplicates
      if (!state.quiz.players.find((p) => p.id === player.id)) {
        state.quiz.players.push(player);
      }
      // Update lobby player list
      if (state.quiz.phase === "lobby") {
        const listEl = document.querySelector(".quiz-player-list");
        const countEl = document.querySelector(".quiz-lobby__players-title");
        const startBtn = document.getElementById("btn-quiz-start") as HTMLButtonElement | null;
        if (listEl) {
          listEl.innerHTML = state.quiz.players
            .map((p) => `<div class="quiz-player-card"><span class="quiz-player-card__name">${esc(p.nickname)}</span></div>`)
            .join("");
        }
        if (countEl) countEl.textContent = `Spelers (${state.quiz.players.length})`;
        if (startBtn) startBtn.disabled = state.quiz.players.length === 0;
      }
    },
    (answer: QuizAnswer) => {
      if (!state.quiz) return;
      state.quiz.currentAnswers.push(answer);
      const countEl = document.getElementById("answer-count");
      if (countEl) {
        countEl.textContent = `${state.quiz.currentAnswers.length} / ${state.quiz.players.length} spelers beantwoord`;
      }
    },
  );

  quizChannel.set(channel);

  // Event delegation
  document.addEventListener("click", handleHostClick);

  async function handleHostClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement;

    if (target.closest("#btn-quiz-start")) {
      try {
        await startQuizGame(quiz.sessionId);
        // Realtime callback will handle phase transition
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Starten mislukt", true);
      }
      return;
    }

    if (target.closest("#btn-reveal-results")) {
      stopTimer();
      await revealResults(render);
      return;
    }

    if (target.closest("#btn-next-question")) {
      if (!state.quiz) return;
      const nextIndex = state.quiz.currentQuestion + 1;
      try {
        await advanceQuizQuestion(quiz.sessionId, nextIndex, quiz.questions.length);
        // Realtime callback handles the phase transition
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Volgende vraag mislukt", true);
      }
      return;
    }

    if (target.closest("#btn-quiz-home") || target.closest("#btn-quiz-back")) {
      cleanupQuizHost();
      state.quiz = null;
      state.view = "home";
      render();
      return;
    }
  }

  // Store handler ref for cleanup
  (window as unknown as Record<string, unknown>)["_quizHostClickHandler"] = handleHostClick;
}

function startTimer(render: () => void): void {
  stopTimer();
  _timer = setInterval(() => {
    if (!state.quiz) { stopTimer(); return; }

    const elapsed = Date.now() - state.quiz.questionStartedAt;
    const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));

    const timerEl = document.getElementById("quiz-timer");
    if (timerEl) {
      timerEl.textContent = String(remaining);
      if (remaining < 5) {
        timerEl.classList.add("quiz-timer--urgent");
      } else {
        timerEl.classList.remove("quiz-timer--urgent");
      }
    }

    if (remaining === 0) {
      stopTimer();
      // Auto-reveal on time up
      void revealResults(render);
    }
  }, 500);
}

function stopTimer(): void {
  if (_timer !== null) {
    clearInterval(_timer);
    _timer = null;
  }
}

async function revealResults(render: () => void): Promise<void> {
  if (!state.quiz) return;
  try {
    const answers = await fetchAnswersForQuestion(state.quiz.sessionId, state.quiz.currentQuestion);
    state.quiz.currentAnswers = answers;

    // Tally scores per player for this question
    const scoreMap = new Map<string, number>();
    for (const a of answers) {
      scoreMap.set(a.playerId, (scoreMap.get(a.playerId) ?? 0) + a.pointsEarned);
    }

    // Refresh player list with updated scores
    const freshPlayers = await fetchQuizPlayers(state.quiz.sessionId);
    state.quiz.players = freshPlayers;

    state.quiz.phase = "after-question";
    render();
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Resultaten ophalen mislukt", true);
  }
}

export function cleanupQuizHost(): void {
  stopTimer();
  quizChannel.cleanup();
  const handler = (window as unknown as Record<string, unknown>)["_quizHostClickHandler"] as EventListener | undefined;
  if (handler) {
    document.removeEventListener("click", handler);
    delete (window as unknown as Record<string, unknown>)["_quizHostClickHandler"];
  }
}
