/*
  ── Supabase SQL migrations ─────────────────────────────────────────────────
  Run these in the Supabase SQL editor before using the quiz feature.

  -- 1. Quiz sessions
  create table public.quiz_sessions (
    id          text primary key,           -- 6-char code
    deck_name   text not null,
    questions   jsonb not null,             -- QuizQuestion[]
    status      text not null default 'lobby', -- 'lobby' | 'playing' | 'finished'
    current_question  integer not null default -1,
    question_started_at timestamptz,
    host_id     uuid references auth.users(id) on delete cascade,
    created_at  timestamptz not null default now()
  );
  alter table public.quiz_sessions enable row level security;
  create policy "Anyone can read quiz sessions" on public.quiz_sessions for select using (true);
  create policy "Auth users can insert quiz sessions" on public.quiz_sessions for insert with check (auth.uid() = host_id);
  create policy "Host can update quiz sessions" on public.quiz_sessions for update using (auth.uid() = host_id);

  -- 2. Quiz players
  create table public.quiz_players (
    id          uuid primary key default gen_random_uuid(),
    session_id  text references public.quiz_sessions(id) on delete cascade,
    nickname    text not null,
    score       integer not null default 0,
    joined_at   timestamptz not null default now()
  );
  alter table public.quiz_players enable row level security;
  create policy "Anyone can read quiz players" on public.quiz_players for select using (true);
  create policy "Anyone can insert quiz players" on public.quiz_players for insert with check (true);
  create policy "Anyone can update quiz players" on public.quiz_players for update using (true);

  -- 3. Quiz answers
  create table public.quiz_answers (
    id              uuid primary key default gen_random_uuid(),
    session_id      text references public.quiz_sessions(id) on delete cascade,
    player_id       uuid references public.quiz_players(id) on delete cascade,
    question_index  integer not null,
    chosen_answer   text not null,
    is_correct      boolean not null,
    points_earned   integer not null,
    response_ms     integer not null,
    created_at      timestamptz not null default now()
  );
  alter table public.quiz_answers enable row level security;
  create policy "Anyone can read quiz answers" on public.quiz_answers for select using (true);
  create policy "Anyone can insert quiz answers" on public.quiz_answers for insert with check (true);

  ── End of SQL migrations ────────────────────────────────────────────────────
*/

import { supabase } from "./supabase";
import { shuffle } from "../utils/helpers";
import { translateDbError } from "../utils/helpers";
import type { Deck, QuizQuestion, QuizPlayer, QuizAnswer } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types matching DB rows ───────────────────────────────────────────────────

export interface QuizSessionRow {
  id: string;
  deck_name: string;
  questions: QuizQuestion[];
  status: string;
  current_question: number;
  question_started_at: string | null;
  host_id: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function buildQuestions(deck: Deck): QuizQuestion[] {
  const cards = shuffle(deck.cards);
  return cards.map((card) => {
    const otherAnswers = cards
      .filter((c) => c.id !== card.id)
      .map((c) => c.answer);
    const wrong = shuffle(otherAnswers).slice(0, 3);
    // If deck has fewer than 4 cards, pad with placeholder answers
    while (wrong.length < 3) {
      wrong.push(`Optie ${wrong.length + 2}`);
    }
    return {
      question: card.question,
      correctAnswer: card.answer,
      options: shuffle([card.answer, ...wrong]),
    };
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createQuizSession(deck: Deck): Promise<QuizSessionRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd");

  const id = makeCode();
  const questions = buildQuestions(deck);

  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert({
      id,
      deck_name: deck.name,
      questions,
      status: "lobby",
      current_question: -1,
      host_id: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(translateDbError(error, "Quiz aanmaken mislukt"));
  return data as QuizSessionRow;
}

export async function fetchQuizSession(code: string): Promise<QuizSessionRow | null> {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", code.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(translateDbError(error, "Sessie ophalen mislukt"));
  return data as QuizSessionRow | null;
}

export async function addQuizPlayer(sessionId: string, nickname: string): Promise<QuizPlayer> {
  const { data, error } = await supabase
    .from("quiz_players")
    .insert({ session_id: sessionId, nickname, score: 0 })
    .select()
    .single();

  if (error) throw new Error(translateDbError(error, "Meedoen mislukt"));
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    nickname: data.nickname as string,
    score: data.score as number,
  };
}

export async function fetchQuizPlayers(sessionId: string): Promise<QuizPlayer[]> {
  const { data, error } = await supabase
    .from("quiz_players")
    .select("*")
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  if (error) throw new Error(translateDbError(error, "Spelers ophalen mislukt"));
  return (data ?? []).map((r) => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    nickname: r.nickname as string,
    score: r.score as number,
  }));
}

export async function startQuizGame(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("quiz_sessions")
    .update({
      status: "playing",
      current_question: 0,
      question_started_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(translateDbError(error, "Starten mislukt"));
}

export async function advanceQuizQuestion(
  sessionId: string,
  nextIndex: number,
  totalQuestions: number,
): Promise<void> {
  if (nextIndex >= totalQuestions) {
    const { error } = await supabase
      .from("quiz_sessions")
      .update({ status: "finished" })
      .eq("id", sessionId);
    if (error) throw new Error(translateDbError(error, "Afronden mislukt"));
  } else {
    const { error } = await supabase
      .from("quiz_sessions")
      .update({
        current_question: nextIndex,
        question_started_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) throw new Error(translateDbError(error, "Volgende vraag mislukt"));
  }
}

export async function submitQuizAnswer(
  sessionId: string,
  playerId: string,
  questionIndex: number,
  chosenAnswer: string,
  correctAnswer: string,
  responseMs: number,
): Promise<void> {
  const isCorrect = chosenAnswer === correctAnswer;
  // Score: 1000 at 0ms, 100 at 15000ms, linear interpolation
  const pointsEarned = isCorrect
    ? Math.round(1000 - ((1000 - 100) / 15000) * Math.min(responseMs, 15000))
    : 0;

  const { error } = await supabase
    .from("quiz_answers")
    .insert({
      session_id: sessionId,
      player_id: playerId,
      question_index: questionIndex,
      chosen_answer: chosenAnswer,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      response_ms: responseMs,
    });

  if (error) throw new Error(translateDbError(error, "Antwoord insturen mislukt"));
}

export async function fetchAnswersForQuestion(
  sessionId: string,
  questionIndex: number,
): Promise<QuizAnswer[]> {
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("*")
    .eq("session_id", sessionId)
    .eq("question_index", questionIndex);

  if (error) throw new Error(translateDbError(error, "Antwoorden ophalen mislukt"));
  return (data ?? []).map((r) => ({
    playerId: r.player_id as string,
    chosenAnswer: r.chosen_answer as string,
    isCorrect: r.is_correct as boolean,
    pointsEarned: r.points_earned as number,
  }));
}

export async function updatePlayerScores(
  updates: Array<{ playerId: string; score: number }>,
): Promise<void> {
  await Promise.all(
    updates.map(({ playerId, score }) =>
      supabase.from("quiz_players").update({ score }).eq("id", playerId),
    ),
  );
}

export function subscribeToQuizSession(
  sessionId: string,
  onSession: (row: QuizSessionRow) => void,
  onPlayer: (row: QuizPlayer) => void,
  onAnswer: (row: QuizAnswer) => void,
): RealtimeChannel {
  return supabase
    .channel(`quiz:${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "quiz_sessions", filter: `id=eq.${sessionId}` },
      (payload) => onSession(payload.new as QuizSessionRow),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "quiz_players", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const r = payload.new as Record<string, unknown>;
        onPlayer({
          id: r.id as string,
          sessionId: r.session_id as string,
          nickname: r.nickname as string,
          score: r.score as number,
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "quiz_answers", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const r = payload.new as Record<string, unknown>;
        onAnswer({
          playerId: r.player_id as string,
          chosenAnswer: r.chosen_answer as string,
          isCorrect: r.is_correct as boolean,
          pointsEarned: r.points_earned as number,
        });
      },
    )
    .subscribe();
}
