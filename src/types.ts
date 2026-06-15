export interface Flashcard {
  question: string;
  answer: string;
}

export interface Deck {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: Date;
}

export interface AppState {
  view: 'home' | 'study' | 'done';
  decks: Deck[];
  activeDeckId: string | null;
  cardIndex: number;
  flipped: boolean;
  correct: number;
  wrong: number;
  missed: Flashcard[];
  apiKey: string;
  isGenerating: boolean;
  generationProgress: string;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}
