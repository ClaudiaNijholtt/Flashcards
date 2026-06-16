import { state } from "../state";
import { esc } from "../utils/helpers";
import { showToast } from "../utils/helpers";
import {
  addQuizPlayer,
  submitQuizAnswer,
  subscribeToQuizSession,
} from "../services/game";
import { quizChannel } from "../services/realtime";
import type { QuizSessionRow } from "../services/game";
import type { QuizPlayer, QuizAnswer } from "../types";

let _timer: ReturnType<typeof setInterval> | null = null;

const OPTION_LABELS = ["A", "B", "C", "D"];

export function renderQuizPlayer(): string {
  const quiz = state.quiz!;

  if (quiz.phase === "join") {
    return `
      <div class="quiz-layout">
        <div class="quiz-join">
          <h2>Meedoen aan quiz</h2>
          <p class="quiz-join__deck">${esc(quiz.deckName)}</p>
          <div class="quiz-join__form">
            <label class="quiz-join__label" for="quiz-nickname">Jouw naam</label>
            <input
              type="text"
              id="quiz-nickname"
              class="quiz-join__input"
              placeholder="Naam…"
              maxlength="20"
              autocomplete="off"
              value="${esc(quiz.myNickname)}"
            />
            <button class="btn-primary" id="btn-quiz-join">Meedoen</button>
          </div>
          <button class="btn quiz-back" id="btn-quiz-back">Annuleren</button>
        </div>
      </div>`;
  }

  if (quiz.phase === "lobby") {
    return `
      <div class="quiz-layout">
        <div class="quiz-lobby">
          <h2>Lobby</h2>
          <p class="quiz-lobby__deck">${esc(quiz.deckName)}</p>
          <div class="quiz-lobby__waiting-wrap">
            <div class="quiz-lobby__spinner"></div>
            <p class="quiz-lobby__waiting">Wachten op de host…</p>
          </div>
          <p class="quiz-lobby__you">Jij speelt als: <strong>${esc(quiz.myNickname)}</strong></p>
          <p class="quiz-lobby__count">${quiz.players.length} speler${quiz.players.length !== 1 ? "s" : ""} in de lobby</p>
          <button class="btn quiz-back" id="btn-quiz-back">Verlaten</button>
        </div>
      </div>`;
  }

  if (quiz.phase === "question") {
    const q = quiz.questions[quiz.currentQuestion];
    const elapsed = Date.now() - quiz.questionStartedAt;
    const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));

    const optionsHtml = q.options
      .map((opt, i) => `
        <button
          class="quiz-option quiz-option--${OPTION_LABELS[i].toLowerCase()}${quiz.hasAnsweredCurrent ? " quiz-option--selected" : ""}"
          data-answer="${esc(opt)}"
          ${quiz.hasAnsweredCurrent ? "disabled" : ""}
        >
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
        ${quiz.hasAnsweredCurrent
    ? `<div class="quiz-answer-feedback quiz-answer-feedback--submitted">Ingestuurd! Wachten op resultaten…</div>`
    : ""}
        <button class="btn quiz-back" id="btn-quiz-back">Verlaten</button>
      </div>`;
  }

  if (quiz.phase === "after-question") {
    const myAnswer = quiz.currentAnswers.find((a) => a.playerId === quiz.myPlayerId);
    const isCorrect = myAnswer?.isCorrect ?? false;
    const pointsEarned = myAnswer?.pointsEarned ?? 0;
    const myPlayer = quiz.players.find((p) => p.id === quiz.myPlayerId);
    const totalScore = myPlayer?.score ?? 0;

    return `
      <div class="quiz-layout">
        <div class="quiz-answer-result">
          <div class="quiz-answer-feedback ${isCorrect ? "quiz-answer-feedback--correct" : "quiz-answer-feedback--wrong"}">
            <span class="quiz-answer-feedback__icon">${isCorrect ? "✓" : "✗"}</span>
            <span class="quiz-answer-feedback__text">${isCorrect ? "Goed!" : "Fout"}</span>
          </div>
          <div class="quiz-answer-result__points">
            <span class="quiz-answer-result__earned">+${pointsEarned} punten</span>
          </div>
          <div class="quiz-answer-result__total">Totaal: <strong>${totalScore} pts</strong></div>
          <p class="quiz-answer-result__waiting">Wachten op volgende vraag…</p>
        </div>
        <button class="btn quiz-back" id="btn-quiz-back">Verlaten</button>
      </div>`;
  }

  if (quiz.phase === "final") {
    const sorted = [...quiz.players].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === quiz.myPlayerId) + 1;

    const leaderboard = sorted
      .map((p, i) => {
        const isMine = p.id === quiz.myPlayerId;
        return `
          <div class="quiz-leaderboard-row${isMine ? " quiz-leaderboard-row--mine" : ""}">
            <span class="quiz-leaderboard-row__rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <span class="quiz-leaderboard-row__name">${esc(p.nickname)}${isMine ? " (jij)" : ""}</span>
            <span class="quiz-leaderboard-row__score">${p.score} pts</span>
          </div>`;
      })
      .join("");

    return `
      <div class="quiz-layout">
        <div class="quiz-final">
          <h2 class="quiz-final__title">Eindstand</h2>
          <p class="quiz-final__deck">${esc(quiz.deckName)}</p>
          ${myRank > 0 ? `<p class="quiz-final__my-rank">Jouw positie: <strong>${myRank}${myRank === 1 ? "e 🏆" : "e"}</strong></p>` : ""}
          <div class="quiz-leaderboard quiz-leaderboard--final">
            ${leaderboard}
          </div>
          <button class="btn-primary" id="btn-quiz-home">Terug naar home</button>
        </div>
      </div>`;
  }

  return "";
}

export function bindQuizPlayerEvents(render: () => void): void {
  const quiz = state.quiz!;

  // Subscribe to session updates
  const channel = subscribeToQuizSession(
    quiz.sessionId,
    (session: QuizSessionRow) => {
      if (!state.quiz) return;

      if (session.status === "playing") {
        if (state.quiz.phase === "lobby" || state.quiz.phase === "join") {
          // Game started
          state.quiz.phase = "question";
          state.quiz.currentQuestion = session.current_question;
          state.quiz.questionStartedAt = session.question_started_at
            ? new Date(session.question_started_at).getTime()
            : Date.now();
          state.quiz.currentAnswers = [];
          state.quiz.hasAnsweredCurrent = false;
          render();
          startPlayerTimer(render);
        } else if (session.current_question !== state.quiz.currentQuestion) {
          // Next question
          state.quiz.currentQuestion = session.current_question;
          state.quiz.questionStartedAt = session.question_started_at
            ? new Date(session.question_started_at).getTime()
            : Date.now();
          state.quiz.currentAnswers = [];
          state.quiz.hasAnsweredCurrent = false;
          state.quiz.phase = "question";
          render();
          startPlayerTimer(render);
        }
      } else if (session.status === "finished") {
        stopTimer();
        state.quiz.phase = "final";
        render();
      }
    },
    (player: QuizPlayer) => {
      if (!state.quiz) return;
      if (!state.quiz.players.find((p) => p.id === player.id)) {
        state.quiz.players.push(player);
      }
      // Update player count in lobby
      if (state.quiz.phase === "lobby") {
        const countEl = document.querySelector(".quiz-lobby__count");
        if (countEl) {
          const n = state.quiz.players.length;
          countEl.textContent = `${n} speler${n !== 1 ? "s" : ""} in de lobby`;
        }
      }
    },
    (answer: QuizAnswer) => {
      if (!state.quiz) return;
      // Track own answer for after-question display
      if (answer.playerId === state.quiz.myPlayerId) {
        // Update player score optimistically
        const myPlayer = state.quiz.players.find((p) => p.id === state.quiz!.myPlayerId);
        if (myPlayer) myPlayer.score += answer.pointsEarned;
      }
      state.quiz.currentAnswers.push(answer);
    },
  );

  quizChannel.set(channel);

  document.addEventListener("click", handlePlayerClick);

  async function handlePlayerClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement;

    if (target.closest("#btn-quiz-join")) {
      const input = document.getElementById("quiz-nickname") as HTMLInputElement | null;
      const nickname = input?.value.trim() ?? "";
      if (!nickname) { showToast("Vul een naam in", true); return; }
      try {
        const player = await addQuizPlayer(quiz.sessionId, nickname);
        state.quiz!.myPlayerId = player.id;
        state.quiz!.myNickname = nickname;
        state.quiz!.players.push(player);
        state.quiz!.phase = "lobby";
        render();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Meedoen mislukt", true);
      }
      return;
    }

    const answerBtn = (target as HTMLElement).closest<HTMLElement>("[data-answer]");
    if (answerBtn && state.quiz?.phase === "question" && !state.quiz.hasAnsweredCurrent && state.quiz.myPlayerId) {
      const chosenAnswer = answerBtn.dataset.answer ?? "";
      const q = state.quiz.questions[state.quiz.currentQuestion];
      const responseMs = Date.now() - state.quiz.questionStartedAt;
      state.quiz.hasAnsweredCurrent = true;

      // Disable all buttons immediately
      document.querySelectorAll<HTMLButtonElement>("[data-answer]").forEach((btn) => {
        btn.disabled = true;
      });

      // Show submitted feedback
      const existingFeedback = document.querySelector(".quiz-answer-feedback");
      if (!existingFeedback) {
        const feedbackEl = document.createElement("div");
        feedbackEl.className = "quiz-answer-feedback quiz-answer-feedback--submitted";
        feedbackEl.textContent = "Ingestuurd! Wachten op resultaten…";
        document.querySelector(".quiz-options")?.after(feedbackEl);
      }

      try {
        await submitQuizAnswer(
          quiz.sessionId,
          state.quiz.myPlayerId,
          state.quiz.currentQuestion,
          chosenAnswer,
          q.correctAnswer,
          responseMs,
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Antwoord insturen mislukt", true);
        state.quiz.hasAnsweredCurrent = false;
      }
      return;
    }

    if (target.closest("#btn-quiz-home") || target.closest("#btn-quiz-back")) {
      cleanupQuizPlayer();
      state.quiz = null;
      state.view = "home";
      render();
      return;
    }
  }

  (window as unknown as Record<string, unknown>)["_quizPlayerClickHandler"] = handlePlayerClick;
}

function startPlayerTimer(render: () => void): void {
  stopTimer();
  _timer = setInterval(() => {
    if (!state.quiz) { stopTimer(); return; }
    if (state.quiz.phase !== "question") { stopTimer(); return; }

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
      // Player can't advance — host controls pace; just freeze timer display
    }
  }, 500);
}

function stopTimer(): void {
  if (_timer !== null) {
    clearInterval(_timer);
    _timer = null;
  }
}

export function cleanupQuizPlayer(): void {
  stopTimer();
  quizChannel.cleanup();
  const handler = (window as unknown as Record<string, unknown>)["_quizPlayerClickHandler"] as EventListener | undefined;
  if (handler) {
    document.removeEventListener("click", handler);
    delete (window as unknown as Record<string, unknown>)["_quizPlayerClickHandler"];
  }
}
