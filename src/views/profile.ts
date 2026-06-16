import { state } from "../state";
import { esc, showToast } from "../utils/helpers";
import { updatePassword, deleteAccount, getAuthProvider } from "../services/auth";
import { saveUsername } from "../services/profiles";
import { saveApiKey } from "../utils/storage";

export function renderProfile(): string {
	const user = state.user!;
	return `
    <div class="profile-view">
      <button class="btn" id="btn-profile-back"><i data-lucide="arrow-left"></i> Terug</button>
      <h2 class="profile-title">Profiel</h2>

      <div class="profile-card">
        <div class="profile-avatar"><i data-lucide="user"></i></div>
        <div class="profile-info">
          <div class="profile-info__name">${esc(user.username ?? "—")}</div>
          <div class="profile-info__email">${esc(user.email ?? "")}</div>
        </div>
      </div>

      <section class="profile-section">
        <h3 class="profile-section__title">Gebruikersnaam wijzigen</h3>
        <div class="profile-field">
          <input
            type="text"
            id="username-new"
            placeholder="${esc(user.username ?? "Gebruikersnaam")}"
            maxlength="20"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button class="btn-primary" id="btn-save-username">Opslaan</button>
        </div>
        <p class="profile-hint">3–20 tekens, letters, cijfers en _</p>
        <div class="profile-error hidden" id="username-error"></div>
      </section>

      <section class="profile-section">
        <h3 class="profile-section__title">API-sleutel</h3>
        <p class="profile-hint">Vereist om decks te genereren via Claude AI.</p>
        <div class="profile-field">
          <input type="password" id="api-input-profile" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" spellcheck="false" />
          <button class="btn-primary" id="btn-save-api">Opslaan</button>
        </div>
        <div id="api-error" class="profile-error hidden"></div>
        <p class="api-status ${state.apiKey ? "api-status--set" : "api-status--unset"}" id="api-status-hint">
          ${state.apiKey ? "✓ API-sleutel ingesteld" : "Nog geen API-sleutel ingesteld"}
        </p>
      </section>

      <section class="profile-section" id="section-password">
        <h3 class="profile-section__title" id="pw-section-title">Wachtwoord wijzigen</h3>
        <div class="profile-field profile-field--col">
          <div class="pw-wrap">
            <input type="password" id="pw-new" placeholder="Nieuw wachtwoord" autocomplete="new-password" />
            <button type="button" class="pw-toggle" data-target="pw-new" aria-label="Tonen/verbergen"><i data-lucide="eye"></i></button>
          </div>
          <div class="pw-wrap">
            <input type="password" id="pw-confirm" placeholder="Bevestig wachtwoord" autocomplete="new-password" />
            <button type="button" class="pw-toggle" data-target="pw-confirm" aria-label="Tonen/verbergen"><i data-lucide="eye"></i></button>
          </div>
        </div>
        <div class="profile-error hidden" id="pw-error"></div>
        <button class="btn-primary" id="btn-save-pw" style="margin-top:0.75rem">Wachtwoord opslaan</button>
      </section>

      <section class="profile-section profile-section--danger">
        <h3 class="profile-section__title">Gevarenzone</h3>
        <p class="profile-hint">Dit verwijdert je account en alle bijbehorende data permanent.</p>
        <button class="btn-danger" id="btn-delete-account"><i data-lucide="trash-2"></i> Account verwijderen</button>
      </section>
    </div>
  `;
}

export function bindProfileEvents(render: () => void): void {
	document.getElementById("btn-profile-back")?.addEventListener("click", () => {
		state.view = "home";
		render();
	});

	// Show/hide password toggles
	document.querySelectorAll<HTMLButtonElement>(".pw-toggle").forEach((btn) => {
		btn.addEventListener("click", () => {
			const input = document.getElementById(btn.dataset.target!) as HTMLInputElement | null;
			if (!input) return;
			const showing = input.type === "text";
			input.type = showing ? "password" : "text";
			btn.innerHTML = showing ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
			// Re-init the icon we just swapped in
			import("lucide").then(({ createIcons, Eye, EyeOff }) => createIcons({ icons: { Eye, EyeOff } }));
		});
	});

	// Save API key
	document.getElementById("btn-save-api")?.addEventListener("click", () => {
		const input = document.getElementById("api-input-profile") as HTMLInputElement;
		const key = input.value.trim();
		if (!key) { showProfileError("api-error", "Voer een geldige API-sleutel in"); return; }
		state.apiKey = key;
		saveApiKey(key);
		hideProfileError("api-error");
		showToast("API-sleutel opgeslagen ✓");
		const hint = document.getElementById("api-status-hint");
		if (hint) { hint.textContent = "✓ API-sleutel ingesteld"; hint.className = "api-status api-status--set"; }
	});

	// Change username
	document.getElementById("btn-save-username")?.addEventListener("click", async () => {
		const input = document.getElementById("username-new") as HTMLInputElement;
		const username = input.value.replace(/[^a-zA-Z0-9_]/g, "").trim();
		if (username.length < 3) {
			showProfileError("username-error", "Minimaal 3 tekens");
			return;
		}
		const btn = document.getElementById("btn-save-username") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Opslaan…";
		try {
			await saveUsername(username);
			state.user!.username = username;
			showToast("Gebruikersnaam bijgewerkt ✓");
			input.value = "";
			input.placeholder = username;
		} catch (err) {
			showProfileError("username-error", err instanceof Error ? err.message : "Opslaan mislukt");
		} finally {
			btn.disabled = false;
			btn.textContent = "Opslaan";
		}
	});

	// For OAuth-only accounts: change title so it's clear they're setting a new password
	void getAuthProvider().then((provider) => {
		if (provider !== "email") {
			const title = document.getElementById("pw-section-title");
			if (title) title.textContent = "Wachtwoord instellen";
			const section = document.getElementById("section-password");
			if (section) {
				const hint = document.createElement("p");
				hint.className = "profile-hint";
				hint.textContent = "Stel een wachtwoord in zodat je ook met e-mail kunt inloggen.";
				section.insertBefore(hint, section.querySelector(".profile-field"));
			}
		}
	});

	// Change password
	document.getElementById("btn-save-pw")?.addEventListener("click", async () => {
		const pw = (document.getElementById("pw-new") as HTMLInputElement).value;
		const confirm = (document.getElementById("pw-confirm") as HTMLInputElement).value;

		if (pw.length < 6) {
			showProfileError("pw-error", "Wachtwoord moet minimaal 6 tekens bevatten");
			return;
		}
		if (pw !== confirm) {
			showProfileError("pw-error", "Wachtwoorden komen niet overeen");
			return;
		}

		const btn = document.getElementById("btn-save-pw") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Opslaan…";
		try {
			await updatePassword(pw);
			showToast("Wachtwoord gewijzigd ✓");
			(document.getElementById("pw-new") as HTMLInputElement).value = "";
			(document.getElementById("pw-confirm") as HTMLInputElement).value = "";
			hideProfileError("pw-error");
		} catch (err) {
			showProfileError("pw-error", err instanceof Error ? err.message : "Wijzigen mislukt");
		} finally {
			btn.disabled = false;
			btn.textContent = "Wachtwoord opslaan";
		}
	});

	// Delete account
	document.getElementById("btn-delete-account")?.addEventListener("click", async () => {
		const confirmed = confirm(
			"Weet je het zeker? Dit verwijdert je account, al je decks en voortgangsdata permanent. Dit kan niet ongedaan worden gemaakt.",
		);
		if (!confirmed) return;

		const btn = document.getElementById("btn-delete-account") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Verwijderen…";
		try {
			await deleteAccount();
			state.user = null;
			state.decks = [];
			state.view = "home";
			showToast("Account verwijderd");
			render();
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Verwijderen mislukt", true);
			btn.disabled = false;
			btn.innerHTML = '<i data-lucide="trash-2"></i> Account verwijderen';
		}
	});
}

function showProfileError(id: string, msg: string): void {
	const el = document.getElementById(id);
	if (el) { el.textContent = msg; el.classList.remove("hidden"); }
}

function hideProfileError(id: string): void {
	document.getElementById(id)?.classList.add("hidden");
}
