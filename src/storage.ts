import type { Deck } from './types';

const KEYS = {
  apiKey: 'fc_api_key',
  decks: 'fc_decks',
} as const;

export function saveApiKey(key: string): void {
  localStorage.setItem(KEYS.apiKey, key);
}

export function loadApiKey(): string {
  return localStorage.getItem(KEYS.apiKey) ?? '';
}

export function saveDecks(decks: Deck[]): void {
  localStorage.setItem(KEYS.decks, JSON.stringify(decks));
}

export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(KEYS.decks);
    if (!raw) return [];
    return JSON.parse(raw) as Deck[];
  } catch {
    return [];
  }
}

export function deleteDeck(id: string, decks: Deck[]): Deck[] {
  const updated = decks.filter(d => d.id !== id);
  saveDecks(updated);
  return updated;
}
