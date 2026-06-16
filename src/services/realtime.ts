import type { RealtimeChannel } from "@supabase/supabase-js";

let _ch: RealtimeChannel | null = null;

export const duelChannel = {
	get: (): RealtimeChannel | null => _ch,
	set: (ch: RealtimeChannel): void => { _ch = ch; },
	cleanup: (): void => {
		_ch?.unsubscribe();
		_ch = null;
	},
};

let _qch: RealtimeChannel | null = null;

export const quizChannel = {
	get: (): RealtimeChannel | null => _qch,
	set: (ch: RealtimeChannel): void => { _qch = ch; },
	cleanup: (): void => {
		_qch?.unsubscribe();
		_qch = null;
	},
};
