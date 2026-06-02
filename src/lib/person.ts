import type { Database } from '$lib/supabase/types';

type PersonNameParts = Pick<
	Database['public']['Tables']['persons']['Row'],
	'given_names' | 'surname' | 'nickname'
>;

/** Best display name for a person: "Given Surname", else nickname, else a fallback. */
export function personName(person: PersonNameParts): string {
	const full = [person.given_names, person.surname].filter(Boolean).join(' ').trim();
	if (full) return full;
	if (person.nickname) return person.nickname;
	return 'Unnamed person';
}

/** Initials for the avatar fallback (e.g. "AM"), else "?". */
export function personInitials(person: PersonNameParts): string {
	const first = person.given_names?.trim()?.[0];
	const last = person.surname?.trim()?.[0];
	const initials = `${first ?? ''}${last ?? ''}`.toUpperCase();
	if (initials) return initials;
	return person.nickname?.trim()?.[0]?.toUpperCase() ?? '?';
}
