import { state } from "../state";
import { esc } from "../utils/helpers";

export function renderGenerating(): string {
	return `
    <div class="app-header">
      <h1>Flashcard Generator</h1>
    </div>
    <div class="generating">
      <div class="generating__spinner"></div>
      <div class="generating__msg">${esc(state.generationProgress)}</div>
    </div>
  `;
}
