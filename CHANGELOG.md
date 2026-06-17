# Changelog

All notable changes to this project will be documented here.

## [1.28.0] - 2026-06-17

### Added

- **Afbeeldingen op kaarten**: voeg een afbeelding toe aan elke kaart via de deck-editor; afbeeldingen worden getoond op de flashcard en in de meerkeuze-vraagkaart
- Afbeeldingen worden opgeslagen in Supabase Storage (bucket `card-images`); vereist eenmalige setup in het Supabase-dashboard (zie `src/services/storage-media.ts`)

---

## [1.24.0] - 2026-06-17

### Added

- **Decks mixen**: knop "Decks mixen" in de zijbalk opent een modal met zoekbalk en tag-chips; selecteer meerdere decks en start een studeersessie met alle kaarten door elkaar geschud
- **Deck splitsen**: via ⋯-menu een deck verdelen in N gelijke delen; live preview toont de kaartverdeling (bijv. 11 + 11)
- **Deck samenvoegen**: via ⋯-menu een deck samenvoegen met andere decks; zoekbalk en deckkaarten met geselecteerde staat; originele decks worden opgeslagen als metadata voor loskoppelen
- **Deck loskoppelen**: samengevoegde decks kunnen via ⋯-menu → "Loskoppelen" worden opgesplitst in de originele decks

### Technical

- `mergedFrom` metadata opgeslagen als JSONB in Supabase (`merged_from` kolom); vereist SQL-migratie: `ALTER TABLE decks ADD COLUMN IF NOT EXISTS merged_from JSONB;`

---

## [1.23.0] - 2026-06-17

### Fixed

- Dark mode: achtergrond, surfaces, borders en muted tekst hebben nu een subtiele blauwe/slate ondertoon (`#181a22` basis) i.p.v. neutraal grijs
- Dark mode: primary knoppen, hover-kleuren en focus-ring afgestemd op de nieuwe achtergrondtint
- Dark mode: "Wist ik niet", "Twijfel" en "Wist ik het" knoppen hadden hardcoded lichte achtergronden; nu donkere varianten in dark mode
- Dark mode: meerkeuze-antwoordtekst was zwart door browser-default op `<button>`; `color: $text` toegevoegd aan `.duel-option`
- Dark mode: mode-kaarten (Flashcards / Meerkeuze) waren te donker en kleurden samen met de pagina-achtergrond; nu `color: $text`, lichtere achtergrond en border in dark mode

---

## [1.22.0] - 2026-06-17

### Fixed

- Dark mode: "Flashcards" en "Meerkeuze" keuzekaarten hadden zwarte titeltekst; `color: $text` toegevoegd aan `.mode-card`
- Dark mode: rating-knoppen ("Wist ik niet" / "Twijfel" / "Wist ik het") te breed — `flex: 1` verwijderd, knoppen zijn nu inhoudsbreedte en gecentreerd

---

## [1.21.0] - 2026-06-16

### Added

- **Kahoot-quiz**: multiplayer kennisquiz op basis van elk deck
  - Host klikt "Quiz starten" in het ⋯-menu van een deck en krijgt een 6-cijferige code
  - Spelers voeren de code in bij "Meedoen aan een spel" en kiezen een bijnaam
  - Host ziet live spelerslijst en klikt "Starten" zodra iedereen aanwezig is
  - Elke vraag toont de voorkant van een kaart met 4 gekleurde antwoordknoppen (1 goed + 3 afleiders)
  - 15-seconden afteltimer gesynchroniseerd via `question_started_at` in de database
  - Punten op basis van snelheid: correct = 100–1000 punten, fout = 0 punten
  - Na elke vraag: correct antwoord getoond, tussenstand bijgewerkt
  - Eindscherm met volledige ranglijst; eigen positie gemarkeerd bij spelers
  - Drie nieuwe Supabase-tabellen: `quiz_sessions`, `quiz_players`, `quiz_answers`
  - Live spelerslijst en vraagvoortgang via Supabase Realtime (postgres_changes)

---

## [1.20.0] - 2026-06-16

### Added

- **API-sleutel op profielpagina**: Claude AI-sleutel instellen/wijzigen vanuit het profiel (was eerder apart paneel op de homepagina)

### Fixed

- Inputtekst in dark mode was zwart in plaats van licht op de profielpagina
- Primaire knoppen (Leren, Deck toevoegen, Meedoen) hadden in dark mode een lichte achtergrond met lichte tekst — nu altijd donker/licht contrast via CSS-variabelen (`--btn-primary-bg/fg/hover`)
- Hover op de thema-wissel-knop was rood; btn-icon hover is nu neutraal, alleen `btn-icon--danger` heeft rode hover

---

## [1.19.0] - 2026-06-16

### Added

- **Deck delen**: elk deck krijgt een unieke 6-tekens deelcode via de "Delen"-optie in het ⋯-menu
- **Deck overnemen**: andere gebruikers kunnen een deck ophalen via deelcode en het aan hun eigen collectie toevoegen
- **Meedoen aan een spel**: aparte sectie in de zijbalk (boven "Deck toevoegen") voor het invoeren van een duel- of quizcode, vervangt de toggleknop in het modal
- **Glass modal voor deck toevoegen**: klik op "Deck toevoegen" opent een overlay met frosted-glass effect (backdrop-filter blur + saturate)
- **FAB op mobiel**: floating action button (altijd zichtbaar op mobiel) om het modal te openen zonder te scrollen
- iOS Safari auto-zoom fix: alle inputs krijgen op ≤600px schermen `font-size: 16px`

### Fixed

- "Kon deelcode niet aanmaken" — `share_code`-kolom ontbrak in de Supabase `decks`-tabel; `shareDeck()` controleert nu correct op bestaande code vóór update

---

## [1.18.0] - 2026-06-16

### Added

- **Streakteller**: vlam-badge in de hero toont hoeveel aaneengesloten dagen je hebt geoefend
- **"Leer vandaag"-knop** per deck: filtert automatisch op kaarten die vandaag te leren zijn (SRS-schema) en start een sessie alleen met die kaarten
- `fetchStreak()` en `fetchAllDueCounts()` in `services/srs.ts`
- `studyCards` in AppState: werkende kaartlijst los van `deck.cards`, zodat `deck.cards` nooit meer gemuteerd wordt
- Streak en due-counts worden herladen na elke studeersessie (terug naar home) en bij inloggen

### Fixed

- `persistSession` sloeg SRS-voortgang op voor álle kaarten in een deck, ook niet-bestudeerde — nu alleen nog voor kaarten die daadwerkelijk beoordeeld zijn
- "Herhaal"-knop op het done-scherm werkte niet meer na refactor; gebruikt nu `state.studyCards` correct

---

## [1.17.0] - 2026-06-16

### Added

- **Deck hernoemen**: decknaam direct aanpasbaar in de deck-editor
- **Kaarten bewerken**: vraag en antwoord van iedere kaart bewerken in de deck-editor
- **Kaarten verwijderen**: individuele kaarten verwijderen via de deck-editor
- **Kaarten toevoegen**: nieuwe lege kaart toevoegen onderaan het deck
- Potlood-icoon per deck op de homepagina opent de editor; wijzigingen worden direct opgeslagen in Supabase

---

## [1.16.0] - 2026-06-16

### Added

- **Ongedaan maken**: laatste kaartbeoordeling terugdraaien via de "Ongedaan"-knop of sneltoets `U`
- `lastCardSnapshot` in AppState slaat de toestand op vóór elke beoordeling

---

## [1.15.0] - 2026-06-16

### Added

- **Deck zoeken**: zoekbalk in de sectieheader filtert decks live op naam zonder volledige herrender

---

## [1.14.0] - 2026-06-16

### Added

- **Donker thema**: CSS custom properties (`--bg`, `--surface`, `--text`, …) op `:root` en `[data-theme="dark"]` op `<html>`, zodat het thema runtime wisselbaar is zonder hercompilatie
- Maan/zon-knop in de topbar wisselt het thema; voorkeur opgeslagen in `localStorage`
- SASS-variabelen verwijzen naar `var(--xxx)` zodat `color.adjust()` op custom properties vermeden wordt

---

## [1.13.0] - 2026-06-16

### Added

- **Solo multiple choice**: bij het starten van een studeersessie kies je nu tussen flashcards of multiple choice
- MC-modus toont 4 opties (1 correct + 3 afleiders uit het deck), score wordt vastgelegd vóór het antwoord zichtbaar is
- MC-opties blijven stabiel over herren­ders (tegenstander-voortgang update reset de opties niet)
- Sneltoetsen in solo MC: `1–4` om te selecteren, `Spatie`/`Enter`/`→` voor volgende kaart

---

## [1.12.0] - 2026-06-16

### Added

- **Anti-cheat duel**: duelmode gebruikt nu verplichte multiple choice — je moet het juiste antwoord aanwijzen, knoppen op de voorkant van de kaart zijn verdwenen
- Score (goed/fout) wordt vastgelegd zodra je een keuze maakt, vóór het antwoord zichtbaar is
- 4 opties: 1 correct + 3 willekeurige afleiders uit het deck, per kaart opnieuw geschud

---

## [1.11.0] - 2026-06-16

### Added

- **Deck maker**: gebruikersnaam van de maker staat op elke deckaart
- **Duel speelcount**: aantal keer dat een deck in een afgerond duel is gebruikt zichtbaar op de deckaart
- `creator_username` kolom toegevoegd aan `decks`-tabel; `deck_id` kolom toegevoegd aan `duels`-tabel (migratie in `supabase/migrations/20260616_deck_creator_plays.sql`)

### Fixed

- Wachtwoord wijzigen werkte niet voor Google/GitHub-accounts — sectie is nu altijd zichtbaar; voor OAuth-gebruikers verandert de titel naar "Wachtwoord instellen" met een toelichting

---

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
