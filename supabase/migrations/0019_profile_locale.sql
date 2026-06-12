-- Per-user UI language. Mirrored into a non-httpOnly `ha_locale` cookie at
-- request time so SSR (and anonymous /share pages) render in the right language.
alter table public.profiles
	add column if not exists locale text not null default 'en'
		check (locale in ('en', 'de'));
