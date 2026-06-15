# ⚡ Flashcard Generator

AI-powered flashcard app. Upload een PDF of tekstbestand en laat Claude flashcards genereren. Werkt als PWA op je telefoon.

## Vereisten

- [Node.js](https://nodejs.org/) v18 of nieuwer
- Een [Anthropic API-sleutel](https://console.anthropic.com/keys)

## Installeren & starten

```bash
# 1. Kloon de repo
git clone https://github.com/JOUW-NAAM/flashcard-app.git
cd flashcard-app

# 2. Installeer dependencies
npm install

# 3. Start de dev server (http://localhost:3000)
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
# Eenmalig installeren
npm install -g gh-pages

# Deployen
npx gh-pages -d dist
```

4. Ga naar repo Settings → Pages → Branch: `gh-pages` → Save
5. Je app is live op `https://JOUW-NAAM.github.io/flashcard-app`

## Als PWA installeren op je telefoon

**iPhone (Safari):**
1. Open de app-URL in Safari
2. Tik op het Deel-icoon (vierkantje met pijltje omhoog)
3. Kies "Zet op beginscherm"

**Android (Chrome):**
1. Open de app-URL in Chrome
2. Tik op de drie puntjes → "Toevoegen aan startscherm"

## Projectstructuur

```
flashcard-app/
├── public/
│   ├── index.html        # HTML template
│   ├── manifest.json     # PWA manifest
│   └── favicon.svg
├── src/
│   ├── index.ts          # App controller & rendering
│   ├── api.ts            # Anthropic API client
│   ├── storage.ts        # localStorage helpers
│   ├── types.ts          # TypeScript interfaces
│   └── styles/
│       └── main.scss     # Alle stijlen
├── tsconfig.json
├── webpack.config.js
└── package.json
```

## Ondersteunde bestandsformaten

| Formaat | Ondersteuning |
|---------|--------------|
| PDF     | ✅ Volledige tekst via Anthropic's document API |
| TXT     | ✅ Directe upload |
| Markdown (.md) | ✅ Directe upload |

## Aanpassen

- **Prompt aanpassen**: `src/api.ts` → `FLASHCARD_PROMPT`
- **Stijlen**: `src/styles/main.scss` — volledig in SCSS met variabelen bovenaan
- **Nieuw scherm toevoegen**: voeg een view toe in `AppState['view']` en render-functie in `src/index.ts`
