# Changelog

All notable changes to this project will be documented here.

## [1.10.0] - 2026-06-16

### Added

- **Profielpagina**: klik op je gebruikersnaam in de topbar om je profiel te openen
- **Gebruikersnaam wijzigen**: direct aanpasbaar op de profielpagina
- **Wachtwoord wijzigen**: nieuw wachtwoord instellen (verborgen voor OAuth-gebruikers)
- **Account verwijderen**: permanente accountverwijdering via gevarenzone met bevestigingsdialoog
- Wachtwoordveld met toon/verberg-knop (oogicoon) op de profielpagina
- SQL-functie `delete_own_account()` met `SECURITY DEFINER` zodat gebruikers zichzelf veilig kunnen verwijderen vanaf de client (migration in `supabase/migrations/20260616_delete_account.sql`)

---

## [1.9.0] - 2026-06-16

### Added

- **Spaced repetition (SRS)**: cards are scheduled using a simplified SM-2 algorithm — missed cards come back sooner, well-known cards later
- **Three-button difficulty rating**: "Wist ik niet" / "Twijfel" / "Wist ik het" replaces the two-button system; quality feeds directly into SRS scheduling
- **Statistics per deck**: bar chart of last 7 sessions, summary cards (sessions, average %, best %, cards studied), full history list; accessible via the chart icon on each deck card
- **Study session tracking**: duration, correct/wrong/doubt counts saved per session to Supabase
- Stable card IDs: every card now gets a UUID; existing cards without IDs receive a deterministic hash-based fallback ID
- Keyboard shortcuts updated: `1` = niet geweten, `2` = twijfel, `3` = geweten
- New Supabase tables: `card_progress` and `study_sessions` with RLS (migration in `supabase/migrations/20260616_srs.sql`)

### Changed

- Done screen now shows breakdown: geweten / twijfel / niet geweten + session duration
- "Retry" button on done screen includes both "twijfel" and "niet geweten" cards

---

## [1.8.0] - 2026-06-16

### Added

- Friendly Dutch error messages replace raw Supabase/PostgrestError strings throughout the app
- `translateDbError()` helper maps Postgres error codes (23505, 23503, 42501, PGRST116, PGRST301) and message patterns to Dutch
- Auth error translator expanded with patterns for rate limits, invalid email, and network failures

### Changed

- Homepage redesigned: topbar with brand + username + logout icon, greeting with first name, stats bar showing deck and card counts, deck cards with study button per deck, empty state illustration
- Security: Content-Security-Policy meta tag added, `rel="noopener noreferrer"` on all external links, API key stored in sessionStorage instead of localStorage
- Architecture: `duel-channel.ts` singleton manages Supabase Realtime cleanup; dead guest-join code removed from duel-lobby; `fetchProfile` accepts optional userId for host lookup

### Fixed

- "Gebruikersnaam opslaan mislukt" — PostgrestError was not instanceof Error; now wrapped properly
- "Duel aanmaken mislukt" — same PostgrestError wrapping fix in duel-db.ts
- "Duelcode niet gevonden" for valid codes — RLS SELECT policy updated to allow reading `waiting` duels before joining; `fetchDuelByCode` switched to `.maybeSingle()` with explicit not-found check

---

## [1.6.0] - 2026-06-15

### Added

- Usernames: every account now has a username chosen on first login
- Username setup screen shown automatically after registering or first OAuth login
- Usernames displayed in user bar (replaces raw email), duel scoreboard, and duel results
- Lucide icons used consistently across all views: score counters (✓/✗), shuffle button, prev/next nav, back buttons, duel action buttons, retry/restart on done screen, swords icon on duel buttons

### Changed

- Auth registration: only one password field required (no repeat)
- Auth: live password strength meter shown while typing during registration
- Auth: show/hide password toggle on the password field
- Email confirmation link now redirects back to the app instead of a 404

### Fixed

- Supabase email confirmation redirect leading to 404 — `emailRedirectTo` now set to the current app origin

---

## [1.5.0] - 2026-06-15

### Added

- Duel mode: two players can study the same deck simultaneously in real time
- Host creates a duel from any deck and shares a 6-character room code
- Guest joins by entering the code from the home screen
- Live opponent progress bar synced via Supabase Broadcast channels
- Result screen shows winner (most correct answers; time as tiebreaker)
- Duel lobby with spinner while waiting for opponent to join

---

## [1.4.0] - 2026-06-15

### Added

- Lucide icons for logout, import (JSON), export (JSON) and delete buttons — replaces plain text labels

---

## [1.3.0] - 2026-06-15

### Added

- Swipe gestures on mobile: swipe left/right to navigate (before flip) or mark correct/wrong (after flip)
- Deck animation: card slides off screen on swipe, next card peeks up behind current card
- Shake-to-shuffle: shake the device after tapping the shuffle button once to grant permission (iOS 13+)
- Mobile mark buttons enlarged for easier tapping
- Keyboard hint and mobile hint shown separately based on screen size

### Changed

- Shake sensitivity tuned: threshold 15, cooldown 1000 ms

### Fixed

- Long card text no longer overflows the navigation — card height now grows with content via CSS grid trick (`grid-template-areas: "card"` on `.card-inner`)
- Double-tap zoom on shuffle button disabled via `touch-action: manipulation`
- Tap after swipe no longer accidentally flips the card (`swipeHandled` flag)

---

## [1.2.0] - 2026-06-15

### Added

- Export any deck as a `.json` file (download button per deck)
- Import a deck from a `.json` file via the import button on the home screen
- JSON format: `{ name, cards: [{ question, answer }] }` with validation and error feedback
- Import works both logged in (syncs to Supabase) and offline (saves to localStorage)

---

## [1.1.0] - 2026-06-15

### Added

- Supabase authentication: email/password login and registration, Google OAuth, GitHub OAuth
- Cloud deck storage: decks synced to Supabase with Row Level Security (users only see their own data)
- LocalStorage decks automatically migrated to the cloud on first login
- Auth view with login/register tabs and social login buttons
- Logout button in home header

### Fixed

- Supabase deck insert now explicitly includes `user_id` (required despite RLS policy)

---

## [1.0.1] - 2026-06-15

### Changed

- Refactored `index.ts`: HTML templates moved to `src/views/` (home, study, done, generating)
- Extracted shared state to `src/state.ts` and helpers to `src/helpers.ts`
- Split `main.scss` into partials: `_variables`, `_typography`, `_buttons`, `_forms`, `_cards`

---

## [1.0.0] - 2026-06-15

### Added

- AI-powered flashcard generation via Anthropic API (PDF, TXT, Markdown support)
- Flashcard study view with 3D flip animation
- Score tracking (correct / incorrect) per session
- Retry mode for missed cards
- Deck management: create, browse, delete
- API key storage in localStorage
- Drag-and-drop file upload
- PWA manifest for mobile installation
- Keyboard shortcuts (Space, arrow keys, 1/2, S)
- Toast notifications

### Fixed

- Replaced deprecated `darken()` SCSS calls with `color.adjust()`
- Switched sass-loader to modern API to suppress Dart Sass deprecation warnings
