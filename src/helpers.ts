export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function esc(str: string): string {
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
