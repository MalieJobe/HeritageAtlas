/**
 * Toasts (task 5.9) — a tiny app-wide store for consistent async feedback.
 *
 * Usage anywhere:  import { toasts } from '$lib/toast.svelte';
 *                  toasts.success('Saved'); toasts.error('Something went wrong');
 * The <Toaster /> in the root layout renders `toasts.items`.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
}

const DEFAULTS: Record<ToastKind, number> = {
	success: 3500,
	info: 4000,
	error: 6000 // errors linger a little longer
};

class ToastStore {
	items = $state<Toast[]>([]);
	#nextId = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	#push(kind: ToastKind, message: string, ms?: number): number {
		const id = this.#nextId++;
		this.items = [...this.items, { id, kind, message }];
		const duration = ms ?? DEFAULTS[kind];
		if (duration > 0 && typeof setTimeout !== 'undefined') {
			this.#timers.set(
				id,
				setTimeout(() => this.dismiss(id), duration)
			);
		}
		return id;
	}

	success = (message: string, ms?: number) => this.#push('success', message, ms);
	error = (message: string, ms?: number) => this.#push('error', message, ms);
	info = (message: string, ms?: number) => this.#push('info', message, ms);

	dismiss = (id: number) => {
		this.items = this.items.filter((t) => t.id !== id);
		const timer = this.#timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#timers.delete(id);
		}
	};
}

export const toasts = new ToastStore();
