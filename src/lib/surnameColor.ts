/** Deterministic colour per surname — shared so the family graph and (later) the
 *  map dots colour the same family identically.
 *
 *  The palette is intentionally muted and earthy to sit alongside the app's
 *  vintage theme: a fixed low saturation + mid lightness, with only the hue
 *  varying by surname. People with no surname get a neutral sage-grey. */

const SATURATION = 32; // %
const LIGHTNESS = 52; // %
const NEUTRAL = 'hsl(95, 12%, 62%)';

/** FNV-1a — small, fast, well-distributed hash for short strings. */
function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** A stable, theme-harmonious colour for a surname (or a neutral grey if absent). */
export function surnameColor(surname: string | null | undefined): string {
	const key = surname?.trim().toLowerCase();
	if (!key) return NEUTRAL;
	const hue = hashString(key) % 360;
	return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
}
