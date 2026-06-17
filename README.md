# Flashcard Generator

AI-powered flashcard app. Upload een PDF of tekstbestand en laat Claude flashcards genereren. Studeer met flashcards of multiple choice, duel real-time tegen een vriend, speel een Kahoot-stijl quiz met meerdere spelers, en volg je voortgang via spaced repetition.

## Functies

- **AI-generatie** — upload PDF, TXT of Markdown; Claude maakt er flashcards van
- **Spaced repetition (SM-2)** — kaarten worden ingepland op basis van hoe goed je ze wist
- **Streakteller** — vlam-badge toont hoeveel dagen je aaneengesloten hebt geoefend
- **"Leer vandaag"** — één klik om alleen de kaarten te studeren die vandaag op het schema staan
- **Solo multiple choice** — kies per sessie tussen flashcards of MC met 4 opties
- **Duel mode** — real-time competitie met een vriend via een 6-cijferige kamercode (anti-cheat MC)
- **Kahoot-quiz** — multiplayer kennisquiz met timer en snelheidspunten (100–1000 per vraag); host via ⋯-menu, spelers joinen met code
- **Deck splitsen** — verdeel een deck in N gelijke delen via het ⋯-menu
- **Deck samenvoegen** — combineer meerdere decks in één nieuw deck; loskoppelen herstelt de originelen
- **Decks mixen** — selecteer losse decks of alle decks met een tag en studeer ze door elkaar
- **Deck delen** — genereer een deelcode zodat anderen jouw deck kunnen overnemen
- **Statistieken** — sessielijst, staafdiagram, correctheidspercentages per deck
- **Afbeeldingen op kaarten** — voeg een afbeelding toe per kaart via de editor; zichtbaar tijdens studeren
- **Deck editor** — kaarten toevoegen, bewerken, verwijderen; decknaam hernoemen
- **Donker thema** — wisselt runtime, voorkeur opgeslagen in localStorage
- **Deck zoeken & filteren** — live filter op naam en tag op de homepagina
- **Ongedaan maken** — laatste kaartbeoordeling terugdraaien (`U`)
- **Swipe-gebaren & schudden** — navigeren en scoren op mobiel
- **PWA** — installeerbaar op iOS en Android

## Vereisten

- [Node.js](https://nodejs.org/) v18 of nieuwer
- Een [Anthropic API-sleutel](https://console.anthropic.com/keys)
- Een [Supabase](https://supabase.com)-project (voor auth, decks, SRS, duels)

## Installeren & starten

```bash
# 1. Kloon de repo
git clone https://github.com/JOUW-NAAM/flashcard-app.git
cd flashcard-app

# 2. Installeer dependencies
npm install

# 3. Stel Supabase-omgevingsvariabelen in
#    Maak src/services/supabase.ts aan met jouw project-URL en anon key

# 4. Start de dev server (http://localhost:3000)
npm run dev
```

## Builden voor productie

```bash
npm run build
# Output staat in /dist — upload die map naar GitHub Pages, Netlify, of Vercel
```

## Hosten op GitHub Pages

1. Maak een repo aan op GitHub
2. Run `npm run build`
3. Push de `/dist` map naar de `gh-pages` branch:

```bash
npm install -g gh-pages
npx gh-pages -d dist
```

4. Ga naar repo Settings → Pages → Branch: `gh-pages` → Save
5. Je app is live op `https://JOUW-NAAM.github.io/flashcard-app`

## Als PWA installeren op je telefoon

**iPhone (Safari):** Deel-icoon → "Zet op beginscherm"

**Android (Chrome):** Drie puntjes → "Toevoegen aan startscherm"

## Projectstructuur

```
flashcard-app/
├── public/
│   ├── index.html            # HTML template
│   ├── manifest.json         # PWA manifest
│   └── favicon.svg
├── src/
│   ├── index.ts              # App controller & routing
│   ├── state.ts              # Globale AppState
│   ├── types.ts              # TypeScript interfaces
│   ├── services/
│   │   ├── ai.ts             # Anthropic API client
│   │   ├── auth.ts           # Supabase auth helpers
│   │   ├── decks.ts          # CRUD voor decks + deck delen
│   │   ├── duels.ts          # Duel aanmaken & joinen
│   │   ├── game.ts           # Quiz aanmaken, joinen, antwoorden, Realtime
│   │   ├── profiles.ts       # Gebruikersprofielen
│   │   ├── realtime.ts       # Supabase Broadcast/Realtime singletons
│   │   ├── srs.ts            # Card progress, sessions, streak, due counts
│   │   └── supabase.ts       # Supabase client
│   ├── utils/
│   │   ├── helpers.ts        # shuffle, esc, formatDate, showToast
│   │   ├── srs-algorithm.ts  # SM-2 berekening, cardId, todayIso
│   │   └── storage.ts        # localStorage helpers
│   ├── views/
│   │   ├── auth-view.ts
│   │   ├── deck-edit.ts      # Deck- en kaarteditor
│   │   ├── done.ts           # Sessie-afronding + SRS opslaan
│   │   ├── duel-lobby.ts
│   │   ├── duel-result.ts
│   │   ├── duel-study.ts     # Anti-cheat MC duel
│   │   ├── game-host.ts      # Quiz host: lobby, vragen, resultaten, ranglijst
│   │   ├── game-player.ts    # Quiz speler: deelnemen, antwoorden, ranglijst
│   │   ├── generating.ts
│   │   ├── home.ts           # Homepagina + deck zoeken + streak
│   │   ├── profile.ts
│   │   ├── stats.ts
│   │   ├── study-mode-pick.ts # Flashcard of MC kiezen
│   │   ├── study.ts          # Studeerscherm (flashcard & MC)
│   │   └── username-setup.ts
│   └── styles/
│       ├── main.scss
│       ├── _variables.scss   # CSS custom properties (light + dark)
│       ├── _buttons.scss
│       ├── _cards.scss
│       ├── _duel.scss
│       ├── _edit.scss
│       ├── _forms.scss
│       ├── _game.scss        # Quiz layout, antwoordknoppen, timer, ranglijst
│       ├── _home.scss
│       ├── _profile.scss
│       ├── _srs.scss
│       └── _typography.scss
├── supabase/
│   └── migrations/           # SQL-migraties
├── tsconfig.json
├── webpack.config.js
└── package.json
```

## Ondersteunde bestandsformaten

| Formaat        | Ondersteuning                                |
| -------------- | -------------------------------------------- |
| PDF            | Volledige tekst via Anthropic's document API |
| TXT            | Directe upload                               |
| Markdown (.md) | Directe upload                               |

## Sneltoetsen (studeermodus)

| Toets            | Actie                        |
| ---------------- | ---------------------------- |
| `Spatie`         | Kaart omdraaien              |
| `←` / `→`        | Vorige / volgende kaart      |
| `1` / `2` / `3` | Niet geweten / twijfel / geweten |
| `U`              | Laatste beoordeling ongedaan |
| `S`              | Deck herschudden             |
