import type { Deck, UserTag } from '../types';

const KEYS = {
  apiKey: 'fc_api_key',
  decks: 'fc_decks',
  userTags: 'fc_user_tags',
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
    const decks = JSON.parse(raw) as Deck[];
    return decks.map((deck) => ({
      ...deck,
      cards: deck.cards.map((c) => ({ ...c, id: c.id ?? legacyCardId(c) })),
    }));
  } catch {
    return [];
  }
}

function legacyCardId(card: { question: string; answer: string }): string {
  let hash = 0;
  const str = card.question + "\x00" + card.answer;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function deleteDeck(id: string, decks: Deck[]): Deck[] {
  const updated = decks.filter(d => d.id !== id);
  saveDecks(updated);
  return updated;
}

export function clearLocalDecks(): void {
  localStorage.removeItem(KEYS.decks);
}

export function saveUserTags(tags: UserTag[]): void {
  localStorage.setItem(KEYS.userTags, JSON.stringify(tags));
}

export function loadUserTags(): UserTag[] {
  try {
    const raw = localStorage.getItem(KEYS.userTags);
    return raw ? (JSON.parse(raw) as UserTag[]) : [];
  } catch {
    return [];
  }
}
