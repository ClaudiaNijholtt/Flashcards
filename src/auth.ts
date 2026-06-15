import { supabase } from "./supabase";
import type { AuthUser } from "./types";

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
	const u = data.user!;
	return { id: u.id, email: u.email };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
	const { data, error } = await supabase.auth.signUp({ email, password });
	if (error) throw error;
	const u = data.user!;
	return { id: u.id, email: u.email };
}

export async function signInWithGoogle(): Promise<void> {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: { redirectTo: window.location.origin + window.location.pathname },
	});
	if (error) throw error;
}

export async function signInWithGitHub(): Promise<void> {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: "github",
		options: { redirectTo: window.location.origin + window.location.pathname },
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
}

export async function getSessionUser(): Promise<AuthUser | null> {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session?.user) return null;
	return { id: session.user.id, email: session.user.email };
}

export function onAuthChange(
	callback: (user: AuthUser | null) => void,
): () => void {
	const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
		if (session?.user) {
			callback({ id: session.user.id, email: session.user.email });
		} else {
			callback(null);
		}
	});
	return () => subscription.unsubscribe();
}
