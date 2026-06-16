import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithGitHub } from "../auth";
import { showToast } from "../helpers";

type Mode = "login" | "register";

export function renderAuth(): string {
	return `
    <div class="app-header">
      <h1>Flashcard Generator</h1>
      <p>Log in om je decks in de cloud op te slaan</p>
    </div>

    <div class="auth-card">
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Inloggen</button>
        <button class="auth-tab" data-tab="register">Registreren</button>
      </div>

      <div class="auth-fields">
        <div class="auth-field">
          <label for="auth-email">E-mailadres</label>
          <input type="email" id="auth-email" placeholder="naam@voorbeeld.nl" autocomplete="email" />
        </div>
        <div class="auth-field">
          <label for="auth-password">Wachtwoord</label>
          <div class="password-wrap">
            <input type="password" id="auth-password" placeholder="••••••••" autocomplete="current-password" />
            <button type="button" class="btn-show-pw" id="btn-show-pw" aria-label="Wachtwoord tonen">
              <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div class="pw-strength hidden" id="pw-strength">
            <div class="pw-strength__bar"><div class="pw-strength__fill" id="pw-fill"></div></div>
            <span class="pw-strength__label" id="pw-label"></span>
          </div>
        </div>
        <div class="auth-error hidden" id="auth-error"></div>
        <button class="btn-primary auth-submit" id="auth-submit">Inloggen</button>
      </div>

      <div class="auth-divider"><span>of</span></div>

      <div class="auth-social">
        <button class="btn auth-social-btn" id="btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Doorgaan met Google
        </button>
        <button class="btn auth-social-btn" id="btn-github">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Doorgaan met GitHub
        </button>
      </div>
    </div>
  `;
}

export function bindAuthEvents(): void {
	let mode: Mode = "login";

	const pwInput = document.getElementById("auth-password") as HTMLInputElement;

	document.querySelectorAll<HTMLElement>(".auth-tab").forEach((tab) => {
		tab.addEventListener("click", () => {
			mode = tab.dataset.tab as Mode;
			document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
			tab.classList.add("active");
			const submit = document.getElementById("auth-submit")!;
			submit.textContent = mode === "login" ? "Inloggen" : "Account aanmaken";
			// Show strength meter only in register mode
			document.getElementById("pw-strength")?.classList.toggle("hidden", mode === "login");
			if (mode === "login") updateStrength("");
			clearError();
		});
	});

	// Show/hide password toggle
	document.getElementById("btn-show-pw")?.addEventListener("click", () => {
		const isText = pwInput.type === "text";
		pwInput.type = isText ? "password" : "text";
		const icon = document.getElementById("eye-icon");
		if (icon) {
			icon.innerHTML = isText
				? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
				: `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
		}
	});

	// Live password strength in register mode
	pwInput?.addEventListener("input", () => {
		if (mode === "register") {
			document.getElementById("pw-strength")?.classList.remove("hidden");
			updateStrength(pwInput.value);
		}
	});

	document.getElementById("auth-submit")?.addEventListener("click", async () => {
		const email = (document.getElementById("auth-email") as HTMLInputElement).value.trim();
		const password = pwInput.value;
		clearError();

		if (!email || !password) {
			showError("Vul je e-mailadres en wachtwoord in.");
			return;
		}

		if (mode === "register") {
			const strength = getStrength(password);
			if (strength < 2) {
				showError("Wachtwoord is te zwak. Gebruik minimaal 8 tekens met letters en cijfers.");
				return;
			}
		}

		const btn = document.getElementById("auth-submit") as HTMLButtonElement;
		btn.disabled = true;
		btn.textContent = "Even wachten…";

		try {
			if (mode === "login") {
				await signInWithEmail(email, password);
			} else {
				await signUpWithEmail(email, password);
				showToast("Account aangemaakt — controleer je e-mail ter bevestiging ✓");
				btn.disabled = false;
				btn.textContent = "Account aanmaken";
			}
		} catch (err) {
			showError(translateError(err));
			btn.disabled = false;
			btn.textContent = mode === "login" ? "Inloggen" : "Account aanmaken";
		}
	});

	pwInput?.addEventListener("keydown", (e) => {
		if (e.key === "Enter") document.getElementById("auth-submit")?.click();
	});

	document.getElementById("btn-google")?.addEventListener("click", async () => {
		try { await signInWithGoogle(); } catch (err) { showError(translateError(err)); }
	});

	document.getElementById("btn-github")?.addEventListener("click", async () => {
		try { await signInWithGitHub(); } catch (err) { showError(translateError(err)); }
	});
}

function getStrength(pw: string): number {
	if (pw.length < 6) return 0;
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	return score;
}

function updateStrength(pw: string): void {
	const fill = document.getElementById("pw-fill");
	const label = document.getElementById("pw-label");
	if (!fill || !label) return;

	if (!pw) {
		fill.style.width = "0%";
		fill.style.background = "transparent";
		label.textContent = "";
		return;
	}

	const score = getStrength(pw);
	const levels = [
		{ pct: "20%", color: "#e05252", text: "Zeer zwak" },
		{ pct: "40%", color: "#e07832", text: "Zwak" },
		{ pct: "65%", color: "#e0c032", text: "Redelijk" },
		{ pct: "85%", color: "#4caf7d", text: "Sterk" },
		{ pct: "100%", color: "#2e7d52", text: "Zeer sterk" },
	];
	const lvl = levels[Math.min(score, 4)];
	fill.style.width = lvl.pct;
	fill.style.background = lvl.color;
	label.textContent = lvl.text;
}

function showError(msg: string): void {
	const el = document.getElementById("auth-error")!;
	el.textContent = msg;
	el.classList.remove("hidden");
}

function clearError(): void {
	document.getElementById("auth-error")?.classList.add("hidden");
}

function translateError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes("Invalid login credentials")) return "Onjuist e-mailadres of wachtwoord.";
	if (msg.includes("Email not confirmed")) return "Bevestig eerst je e-mailadres via de link in je mailbox.";
	if (msg.includes("User already registered")) return "Er bestaat al een account met dit e-mailadres.";
	if (msg.includes("Password should be at least")) return "Wachtwoord moet minimaal 6 tekens bevatten.";
	if (msg.includes("Unable to validate email address")) return "Ongeldig e-mailadres.";
	if (msg.includes("Email rate limit exceeded")) return "Te veel pogingen — wacht even en probeer opnieuw.";
	if (msg.includes("over_email_send_rate_limit")) return "Te veel e-mails verstuurd — wacht even en probeer opnieuw.";
	if (msg.includes("network") || msg.includes("fetch")) return "Geen verbinding — controleer je internet.";
	return "Er is een fout opgetreden, probeer het opnieuw.";
}
