import { state } from "../state";
import { saveUsername } from "../profile";
import { fetchDecks } from "../db";
import { showToast } from "../helpers";

export function renderUsernameSetup(): string {
	return `
    <div class="auth-card" style="margin-top:3rem">
      <h2 style="margin-bottom:0.5rem">Kies een gebruikersnaam</h2>
      <p style="font-size:14px;color:#888;margin-bottom:1.5rem">
        Je gebruikersnaam is zichtbaar in duel mode.
      </p>
      <div class="auth-field">
        <label for="username-input">Gebruikersnaam</label>
        <input
          type="text"
          id="username-input"
          placeholder="bijv. kaartjeskoning"
          maxlength="20"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <p style="font-size:12px;color:#aaa;margin-top:4px">3–20 tekens, letters, cijfers en _</p>
      </div>
      <div class="auth-error hidden" id="username-error"></div>
      <button class="btn-primary" id="btn-save-username" style="margin-top:1rem;width:100%">
        Opslaan en verder <i data-lucide="arrow-right"></i>
      </button>
    </div>
  `;
}

export function bindUsernameSetupEvents(render: () => void): void {
	const input = document.getElementById("username-input") as HTMLInputElement;
	const btn = document.getElementById("btn-save-username") as HTMLButtonElement;

	input?.addEventListener("input", () => {
		input.value = input.value.replace(/[^a-zA-Z0-9_]/g, "");
	});

	input?.addEventListener("keydown", (e) => {
		if (e.key === "Enter") btn.click();
	});

	btn?.addEventListener("click", async () => {
		const username = input.value.trim();

		if (username.length < 3) {
			showUsernameError("Minimaal 3 tekens");
			return;
		}

		btn.disabled = true;
		btn.textContent = "Opslaan…";

		try {
			await saveUsername(username);
			state.user!.username = username;
			state.decks = await fetchDecks();
			state.view = "home";
			showToast(`Welkom, ${username}! ✓`);
			render();
		} catch (err) {
			showUsernameError(err instanceof Error ? err.message : "Opslaan mislukt");
			btn.disabled = false;
			btn.textContent = "Opslaan en verder";
		}
	});
}

function showUsernameError(msg: string): void {
	const el = document.getElementById("username-error");
	if (el) { el.textContent = msg; el.classList.remove("hidden"); }
}
