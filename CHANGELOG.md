# Changelog

All notable changes to this project will be documented here.

## [1.0.1] - 2026-06-15

### Changed

- Refactored `index.ts`: HTML templates moved to `src/views/` (home, study, done, generating)
- Extracted shared state to `src/state.ts` and helpers to `src/helpers.ts`
- Split `main.scss` into partials: `_variables`, `_typography`, `_buttons`, `_forms`, `_cards`

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
