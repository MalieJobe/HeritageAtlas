-- Simplify relationships. They're only shown in the tree (never on the map), so
-- they don't need historical dates:
--   * partnerships keep just a current/former status (no type, no dates)
--   * parent_child_links become a plain parent -> child edge (no type)
-- The date_qualifier / date_precision enums and src/lib/fuzzyDate.ts stay — they
-- exist for events (Phase 2), which DO drive the map timeline.

-- parent_child_links: plain parent -> child link.
alter table public.parent_child_links drop column type;
drop type public.parent_child_type;

-- partnerships: drop the fuzzy-date checks, then the date / type / status columns.
alter table public.partnerships drop constraint partnership_began_range;
alter table public.partnerships drop constraint partnership_ended_range;
alter table public.partnerships
	drop column began_date,
	drop column began_date_end,
	drop column began_qualifier,
	drop column began_precision,
	drop column ended_date,
	drop column ended_date_end,
	drop column ended_qualifier,
	drop column ended_precision,
	drop column type,
	drop column status;

drop type public.partnership_type;
drop type public.partnership_status;

create type public.partnership_status as enum ('current', 'former');

alter table public.partnerships
	add column status public.partnership_status not null default 'current';
