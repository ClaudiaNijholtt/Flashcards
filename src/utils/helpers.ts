interface DbError { code?: string; message?: string }

export function translateDbError(err: unknown, context?: string): string {
	const e = err as DbError;
	const code = e?.code ?? "";
	const msg = (e?.message ?? "").toLowerCase();

	if (code === "23505" || msg.includes("unique")) return "Deze waarde is al in gebruik";
	if (code === "23503" || msg.includes("foreign key")) return "Kan niet verwijderen: er zijn afhankelijke gegevens";
	if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) return "Geen toegang — controleer of je ingelogd bent";
	if (code === "PGRST204" || code === "42703") return "Databasekolom ontbreekt — voer de SQL-migratie uit in het Supabase dashboard";
	if (code === "PGRST116" || msg.includes("multiple") || msg.includes("no rows")) return context ?? "Niet gevonden";
	if (code === "PGRST301" || msg.includes("jwt") || msg.includes("token")) return "Sessie verlopen — log opnieuw in";
	if (msg.includes("network") || msg.includes("fetch")) return "Geen verbinding — controleer je internet";
	if (context) return context;
	return "Er is een fout opgetreden, probeer het opnieuw";
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function esc(str: string | null | undefined): string {
	if (!str) return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("nl-NL", {
		day: "numeric",
		month: "short",
	});
}

let toastTimer: ReturnType<typeof setTimeout>;

export function showToast(msg: string, isError = false): void {
	let toast = document.querySelector(".toast");
	if (!toast) {
		toast = document.createElement("div");
		document.body.appendChild(toast);
	}
	toast.className = `toast${isError ? " error" : ""}`;
	toast.textContent = msg;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast?.classList.add("hidden"), 3000);
}
