-- At most one birth and one death event per person.
create unique index events_one_birth_per_person
  on public.events (person_id) where type = 'birth';
create unique index events_one_death_per_person
  on public.events (person_id) where type = 'death';
