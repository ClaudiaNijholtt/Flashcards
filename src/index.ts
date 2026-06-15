import './styles/main.scss';
import type { AppState, Deck, Flashcard } from './types';
import { saveApiKey, loadApiKey, saveDecks, loadDecks, deleteDeck } from './storage';
import { generateFlashcards } from './api';

// ── State ──────────────────────────────────────────────────────────────────
const state: AppState = {
  view: 'home',
  decks: loadDecks(),
  activeDeckId: null,
  cardIndex: 0,
  flipped: false,
  correct: 0,
  wrong: 0,
  missed: [],
  apiKey: loadApiKey(),
  isGenerating: false,
  generationProgress: '',
};

// ── Root render ────────────────────────────────────────────────────────────
function render(): void {
  const app = document.getElementById('app')!;
  if (state.isGenerating) {
    app.innerHTML = renderGenerating();
  } else if (state.view === 'home') {
    app.innerHTML = renderHome();
    bindHomeEvents();
  } else if (state.view === 'study') {
    app.innerHTML = renderStudy();
    bindStudyEvents();
  } else if (state.view === 'done') {
    app.innerHTML = renderDone();
    bindDoneEvents();
  }
}

// ── Home view ──────────────────────────────────────────────────────────────
function renderHome(): string {
  const hasKey = !!state.apiKey;
  const decksHtml = state.decks.length === 0
    ? `<p style="text-align:center;padding:1.5rem 0">Nog geen decks. Upload een document om te beginnen.</p>`
    : state.decks.map(deck => `
      <div class="deck-card" data-id="${deck.id}">
        <div class="deck-card__info">
          <div class="deck-card__name">${esc(deck.name)}</div>
          <div class="deck-card__meta">${deck.cards.length} kaarten &nbsp;·&nbsp; ${formatDate(deck.createdAt)}</div>
        </div>
        <div class="deck-card__actions">
          <button class="btn-icon" data-delete="${deck.id}" title="Verwijderen" aria-label="Deck verwijderen">🗑</button>
        </div>
      </div>`).join('');

  return `
    <div class="app-header">
      <h1>⚡ Flashcard Generator</h1>
      <p>Upload een document en laat AI flashcards maken</p>
    </div>

    <div class="api-key-section">
      <div class="api-key-section__header" id="api-toggle">
        <div class="api-key-section__title">
          <span class="dot ${hasKey ? 'ok' : ''}"></span>
          API-sleutel ${hasKey ? '(opgeslagen)' : '(vereist)'}
        </div>
        <span style="font-size:12px;color:#aaa">${hasKey ? 'Wijzigen ▾' : 'Instellen ▾'}</span>
      </div>
      <div class="api-key-section__body ${hasKey ? 'hidden' : ''}" id="api-body">
        <input type="password" id="api-input" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" />
        <button class="btn-primary" id="api-save">Opslaan</button>
      </div>
      ${!hasKey ? `<p style="margin-top:8px;font-size:12px">Haal je sleutel op via <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener" style="color:#1a1a18">console.anthropic.com</a></p>` : ''}
    </div>

    <div class="upload-zone ${!hasKey ? 'disabled' : ''}" id="upload-zone" role="button" tabindex="0" aria-label="Document uploaden">
      <input type="file" id="file-input" accept=".pdf,.txt,.md" multiple />
      <div class="upload-zone__icon">📄</div>
      <div class="upload-zone__title">Klik of sleep een document</div>
      <div class="upload-zone__sub">PDF, TXT of Markdown · meerdere bestanden tegelijk</div>
    </div>

    ${state.decks.length > 0 ? `<div class="section-title">Mijn decks</div>` : ''}
    <div class="deck-list">${decksHtml}</div>
  `;
}

function bindHomeEvents(): void {
  // API key toggle
  document.getElementById('api-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('api-body');
    body?.classList.toggle('hidden');
  });

  // API key save
  document.getElementById('api-save')?.addEventListener('click', () => {
    const input = document.getElementById('api-input') as HTMLInputElement;
    const key = input.value.trim();
    if (!key) { showToast('Voer een geldige API-sleutel in', true); return; }
    state.apiKey = key;
    saveApiKey(key);
    showToast('API-sleutel opgeslagen ✓');
    render();
  });

  // File upload zone
  const zone = document.getElementById('upload-zone')!;
  const input = document.getElementById('file-input') as HTMLInputElement;

  zone.addEventListener('click', () => {
    if (!state.apiKey) { showToast('Stel eerst een API-sleutel in', true); return; }
    input.click();
  });
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zone.click(); }
  });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) handleFiles(files);
  });
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    if (files.length) handleFiles(files);
  });

  // Deck cards — start study
  document.querySelectorAll<HTMLElement>('.deck-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-delete]')) return;
      const id = card.dataset.id!;
      startStudy(id);
    });
  });

  // Delete buttons
  document.querySelectorAll<HTMLElement>('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete!;
      if (confirm('Deck verwijderen?')) {
        state.decks = deleteDeck(id, state.decks);
        render();
      }
    });
  });
}

async function handleFiles(files: File[]): Promise<void> {
  if (!state.apiKey) { showToast('Stel eerst een API-sleutel in', true); return; }

  for (const file of files) {
    state.isGenerating = true;
    state.generationProgress = 'Starten...';
    render();

    try {
      const cards = await generateFlashcards(state.apiKey, file, (msg) => {
        state.generationProgress = msg;
        const el = document.querySelector('.generating__msg');
        if (el) el.textContent = msg;
      });

      const deckName = file.name.replace(/\.[^.]+$/, '');
      const deck: Deck = {
        id: Date.now().toString(),
        name: deckName,
        cards,
        createdAt: new Date(),
      };

      state.decks.push(deck);
      saveDecks(state.decks);
      showToast(`${cards.length} flashcards aangemaakt ✓`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Onbekende fout', true);
    }
  }

  state.isGenerating = false;
  state.view = 'home';
  render();
}

// ── Generating view ────────────────────────────────────────────────────────
function renderGenerating(): string {
  return `
    <div class="app-header">
      <h1>⚡ Flashcard Generator</h1>
    </div>
    <div class="generating">
      <div class="generating__spinner"></div>
      <div class="generating__msg">${esc(state.generationProgress)}</div>
    </div>
  `;
}

// ── Study view ─────────────────────────────────────────────────────────────
function getActiveDeck(): Deck | undefined {
  return state.decks.find(d => d.id === state.activeDeckId);
}

function startStudy(deckId: string): void {
  state.activeDeckId = deckId;
  state.view = 'study';
  state.cardIndex = 0;
  state.flipped = false;
  state.correct = 0;
  state.wrong = 0;
  state.missed = [];
  // Shuffle
  const deck = getActiveDeck();
  if (deck) deck.cards = shuffle(deck.cards);
  render();
}

function renderStudy(): string {
  const deck = getActiveDeck();
  if (!deck) return '';
  const card = deck.cards[state.cardIndex];
  const pct = Math.round((state.cardIndex / deck.cards.length) * 100);

  return `
    <div class="study-header">
      <button class="btn study-header__back" id="btn-back">← Terug</button>
      <div class="study-header__title">${esc(deck.name)}</div>
    </div>

    <div class="progress-row">
      <span>${state.cardIndex + 1} / ${deck.cards.length}</span>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="score-row">
        <span class="ok">✓ ${state.correct}</span>
        <span class="no">✗ ${state.wrong}</span>
      </div>
    </div>

    <div class="scene" id="scene" role="button" tabindex="0" aria-label="Flashcard">
      <div class="card-inner${state.flipped ? ' flipped' : ''}" id="card">
        <div class="face front">
          <div class="face__deck">${esc(deck.name)}</div>
          <div class="face__q">${esc(card.question)}</div>
          <div class="face__hint"><span class="kbd">Spatie</span> of klik om te draaien</div>
        </div>
        <div class="face back">
          <div class="face__deck">${esc(deck.name)}</div>
          <div class="face__a">${esc(card.answer)}</div>
          <div class="face__hint"><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het &nbsp; klik om terug</div>
        </div>
      </div>
    </div>

    <div class="mark-row${state.flipped ? ' visible' : ''}" id="mark-row">
      <button class="btn-red" id="btn-no">✗ Wist ik niet</button>
      <button class="btn-green" id="btn-ok">✓ Wist ik het</button>
    </div>

    <div class="nav-row">
      <button class="btn" id="btn-prev" ${state.cardIndex === 0 ? 'disabled' : ''}>← Vorige</button>
      <button class="btn" id="btn-shuffle">⇄ Schudden</button>
      <button class="btn" id="btn-next" ${state.cardIndex === deck.cards.length - 1 ? 'disabled' : ''}>Volgende →</button>
    </div>

    <div class="shortcuts" aria-hidden="true">
      <span><span class="kbd">Spatie</span> draaien</span>
      <span><span class="kbd">←</span><span class="kbd">→</span> navigeren</span>
      <span><span class="kbd">1</span> wist niet &nbsp;<span class="kbd">2</span> wist het</span>
      <span><span class="kbd">S</span> schudden</span>
    </div>
  `;
}

function bindStudyEvents(): void {
  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.view = 'home';
    render();
  });

  document.getElementById('scene')?.addEventListener('click', handleCardClick);
  document.getElementById('btn-no')?.addEventListener('click', () => markCard(false));
  document.getElementById('btn-ok')?.addEventListener('click', () => markCard(true));
  document.getElementById('btn-prev')?.addEventListener('click', () => { if (state.cardIndex > 0) { state.cardIndex--; state.flipped = false; render(); } });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    const deck = getActiveDeck();
    if (deck && state.cardIndex < deck.cards.length - 1) { state.cardIndex++; state.flipped = false; render(); }
  });
  document.getElementById('btn-shuffle')?.addEventListener('click', () => {
    const deck = getActiveDeck();
    if (deck) { deck.cards = shuffle(deck.cards); state.cardIndex = 0; state.flipped = false; state.correct = 0; state.wrong = 0; state.missed = []; render(); }
  });
}

function handleCardClick(): void {
  state.flipped = !state.flipped;
  const card = document.getElementById('card');
  const markRow = document.getElementById('mark-row');
  card?.classList.toggle('flipped', state.flipped);
  markRow?.classList.toggle('visible', state.flipped);
}

function markCard(correct: boolean): void {
  if (!state.flipped) return;
  const deck = getActiveDeck();
  if (!deck) return;
  if (correct) { state.correct++; } else { state.wrong++; state.missed.push(deck.cards[state.cardIndex]); }
  if (state.cardIndex < deck.cards.length - 1) {
    state.cardIndex++;
    state.flipped = false;
    render();
  } else {
    state.view = 'done';
    render();
  }
}

// ── Done view ──────────────────────────────────────────────────────────────
function renderDone(): string {
  const total = state.correct + state.wrong;
  const pct = total > 0 ? Math.round((state.correct / total) * 100) : 0;

  return `
    <div class="done-screen">
      <div class="done-screen__pct">${pct}%</div>
      <h2>Deck afgerond!</h2>
      <p>${state.correct} van de ${total} kaarten goed.</p>
      <div class="done-screen__btns">
        ${state.missed.length > 0 ? `<button class="btn-red" id="btn-retry">✗ Herhaal ${state.missed.length} gemiste kaart${state.missed.length === 1 ? '' : 'en'}</button>` : ''}
        <button class="btn-primary" id="btn-restart">↺ Opnieuw</button>
        <button class="btn" id="btn-home">← Decks</button>
      </div>
    </div>
  `;
}

function bindDoneEvents(): void {
  document.getElementById('btn-retry')?.addEventListener('click', () => {
    const deck = getActiveDeck();
    if (!deck) return;
    deck.cards = shuffle(state.missed);
    state.cardIndex = 0;
    state.flipped = false;
    state.correct = 0;
    state.wrong = 0;
    state.missed = [];
    state.view = 'study';
    render();
  });

  document.getElementById('btn-restart')?.addEventListener('click', () => {
    if (state.activeDeckId) startStudy(state.activeDeckId);
  });

  document.getElementById('btn-home')?.addEventListener('click', () => {
    state.view = 'home';
    render();
  });
}

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (state.view !== 'study') return;

  const deck = getActiveDeck();
  if (!deck) return;

  switch (e.key) {
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      handleCardClick();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (state.cardIndex < deck.cards.length - 1) { state.cardIndex++; state.flipped = false; render(); }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (state.cardIndex > 0) { state.cardIndex--; state.flipped = false; render(); }
      break;
    case '1':
      markCard(false);
      break;
    case '2':
      markCard(true);
      break;
    case 's':
    case 'S':
      deck.cards = shuffle(deck.cards);
      state.cardIndex = 0;
      state.flipped = false;
      state.correct = 0;
      state.wrong = 0;
      state.missed = [];
      render();
      break;
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

let toastTimer: ReturnType<typeof setTimeout>;

function showToast(msg: string, isError = false): void {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    document.body.appendChild(toast);
  }
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast?.classList.add('hidden'), 3000);
}

// ── Boot ───────────────────────────────────────────────────────────────────
render();
