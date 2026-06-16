export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface UserTag {
  name: string;
  color: string; // hex value, e.g. "#3b82f6"
}

export const DECK_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "blue",   label: "Blauw",  hex: "#3b82f6" },
  { key: "purple", label: "Paars",  hex: "#8b5cf6" },
  { key: "green",  label: "Groen",  hex: "#22c55e" },
  { key: "yellow", label: "Geel",   hex: "#eab308" },
  { key: "orange", label: "Oranje", hex: "#f97316" },
  { key: "red",    label: "Rood",   hex: "#ef4444" },
  { key: "pink",   label: "Roze",   hex: "#ec4899" },
  { key: "teal",   label: "Teal",   hex: "#14b8a6" },
];

export interface Deck {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: Date;
  creatorUsername?: string;
  playCount?: number;
  tags?: string[];
  color?: string;
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
  view: 'home' | 'study-mode-pick' | 'study' | 'done' | 'duel-lobby' | 'duel-playing' | 'duel-result' | 'username-setup' | 'stats' | 'profile' | 'deck-edit';
  editDeckId: string | null;
  studyMode: 'flashcard' | 'multiple-choice';
  decks: Deck[];
  deckPlayCounts: Record<string, number>;
  deckSearch: string;
  deckTagFilter: string;
  userTags: UserTag[];
  streak: number;
  deckDueCounts: Record<string, number>;
  activeDeckId: string | null;
  studyCards: Flashcard[] | null;
  cardIndex: number;
  flipped: boolean;
  correct: number;
  wrong: number;
  missed: Flashcard[];
  cardQualities: Record<string, Quality>; // cardId → quality
  studyStartTime: number;
  lastCardSnapshot: { cardIndex: number; correct: number; wrong: number; missed: Flashcard[]; qualities: Record<string, Quality> } | null;
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
