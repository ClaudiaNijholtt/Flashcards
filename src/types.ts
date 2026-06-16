export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface Deck {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  email: string | undefined;
  username?: string | null;
}

export interface ActiveDuel {
  id: string;
  code: string;
  deckName: string;
  cards: Flashcard[];
  isHost: boolean;
  cardIndex: number;
  flipped: boolean;
  correct: number;
  wrong: number;
  selfFinished: boolean;
  selfTimeMs: number;
  startTime: number;
  selfName: string;
  opponent: {
    cardsDone: number;
    correct: number;
    wrong: number;
    finished: boolean;
    timeMs: number;
    name: string;
  } | null;
}

export type Quality = 0 | 1 | 2; // 0 = wist het niet, 1 = twijfel, 2 = wist het

export interface CardProgress {
  cardId: string;
  deckId: string;
  dueDate: string;       // YYYY-MM-DD
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface StudySession {
  deckId: string;
  studiedAt: Date;
  cardsStudied: number;
  correct: number;
  wrong: number;
  durationMs: number;
}

export interface AppState {
  view: 'home' | 'study' | 'done' | 'duel-lobby' | 'duel-playing' | 'duel-result' | 'username-setup' | 'stats';
  decks: Deck[];
  activeDeckId: string | null;
  cardIndex: number;
  flipped: boolean;
  correct: number;
  wrong: number;
  missed: Flashcard[];
  cardQualities: Record<string, Quality>; // cardId → quality
  studyStartTime: number;
  apiKey: string;
  isGenerating: boolean;
  generationProgress: string;
  user: AuthUser | null;
  duel: ActiveDuel | null;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}
