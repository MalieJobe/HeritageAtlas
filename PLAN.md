# HeritageAtlas — Build Plan

Tasks are small and individually shippable. Tell me a task number (e.g. "do 1.3") and I'll
do just that one to high quality. Tasks within a phase are roughly ordered by dependency.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

Architecture reference: see [DESIGN.md](DESIGN.md).

---

## Phase 0 — Project setup & scaffolding

- [x] **0.1 Scaffold SvelteKit** — init SvelteKit + TypeScript project (Vite), confirm dev server runs.
- [x] **0.2 Tailwind** — install & configure Tailwind, verify a styled page renders.
- [x] **0.3 Tooling** — ESLint + Prettier + `svelte-check`; add `lint`/`format`/`check` npm scripts.
- [x] **0.4 Repo hygiene** — `.gitignore` (node_modules, .env, .svelte-kit), `.env.example`, `.nvmrc`.
- [x] **0.5 Supabase client** — install `@supabase/supabase-js` + `@supabase/ssr`; create a typed
      browser + server client helper reading env vars. (No tables yet.)
- [x] **0.6 App shell** — root layout: top bar (app name, auth slot), main content area, base theme.
- [x] **0.7 README** — short README: what it is, stack, how to run locally, env vars needed.
- [x] **0.8 CI (optional)** — GitHub Action running `check` + `lint` on push.

## Phase 1 — Foundation: auth, data model, family graph

### Auth

- [ ] **1.1 Supabase Auth setup** — enable email auth; document required env/keys.
- [ ] **1.2 Sign up / sign in / sign out** — auth pages + session handling (SSR-safe).
- [ ] **1.3 Route protection** — redirect unauthenticated users; load session in root layout.
- [ ] **1.4 Profile bootstrap** — `profiles` table + trigger/row on first login; minimal account page.

### Schema (one migration per small group; all with RLS)

- [ ] **1.5 `trees` table** — id, name, owner_id, timestamps + RLS (owner full access).
- [ ] **1.6 `tree_members` table** — tree_id, user_id, role (owner/editor/viewer) + RLS for shared access.
- [ ] **1.7 `persons` table** — names (given, surname, birth/maiden, nickname), sex/gender, notes,
      profile_photo_path, tree_id + RLS via tree membership.
- [ ] **1.8 `relationships` table** — partnership links (type, status, start/end fuzzy dates) +
      parent-child links (typed: bio/adoptive/step/foster). Model as edges referencing persons + RLS.
- [ ] **1.9 Fuzzy-date storage convention** — decide & document columns (value + qualifier + precision);
      add a reusable shape used across persons/relationships/events.
- [ ] **1.10 Generate TS types** — Supabase type generation wired to a script; commit generated types.

### Tree CRUD

- [ ] **1.11 Tree list page** — list trees the user owns/belongs to; create-tree form.
- [ ] **1.12 Tree settings** — rename/delete tree (owner only); show members.
- [ ] **1.13 Invite members** — invite by email, assign role; accept flow.

### Persons CRUD

- [ ] **1.14 Add person** — form for names + gender + notes; create within a tree.
- [ ] **1.15 Edit / delete person** — edit form; safe delete (handle dangling relationships).
- [ ] **1.16 Profile photo upload** — Supabase Storage bucket + upload/crop, set as profile photo.
- [ ] **1.17 Person detail panel** — read view: names, photo, gender, notes, relationships summary.

### Relationships UI

- [ ] **1.18 Add partnership** — link two persons as partners (type/status/dates).
- [ ] **1.19 Add parent-child** — link a child to parent(s) with relationship type.
- [ ] **1.20 Relationship editing/removal** — edit type/dates, remove links.

### Family graph

- [ ] **1.21 Graph data loader** — query persons + relationships for a tree into a graph structure.
- [ ] **1.22 elkjs layout** — feed nodes/edges to elkjs, rank by generation, get positioned coords.
- [ ] **1.23 Render nodes** — pan/zoom SVG (or HTML) nodes: photo/initials, surname-colored border.
- [ ] **1.24 Render edges** — partnership + parent-child connectors styled distinctly.
- [ ] **1.25 Node selection** — click a node → selected-person state; basic detail panel opens.
- [ ] **1.26 Surname color map** — deterministic color per surname, shared util (reused by map dots).
- [ ] **1.27 Graph perf pass** — virtualize/limit redraws for larger trees; smooth pan/zoom.

## Phase 2 — Map basics

### Places & events schema

- [ ] **2.1 `places` table** — name, historical_name, lat, lng, source (geocoded/manual) + RLS.
- [ ] **2.2 `events` table** — person_id, type (birth/death/marriage/residence/occupation/custom),
      fuzzy date, place_id, note + RLS.
- [ ] **2.3 Event types enum/config** — shared definition of event types + display metadata.

### Place entry

- [ ] **2.4 Geocoding search** — Nominatim type-ahead search component (debounced, attribution).
- [ ] **2.5 Pin-drop fallback** — click map to set coords for unfound/vanished places.
- [ ] **2.6 Place reuse** — find-or-create place; avoid duplicate geocodes; pick existing places.

### Events UI

- [ ] **2.7 Add/edit event on person** — form with type, fuzzy date, place picker, note.
- [ ] **2.8 Events list on person detail** — chronological list with place + date.

### Map view

- [ ] **2.9 MapLibre base map** — modern street basemap, pan/zoom, in a Svelte component.
- [ ] **2.10 Position resolver** — given a year, compute each person's place (most recent event ≤ year).
- [ ] **2.11 Dots layer** — render one dot per located person; photo/initials + surname-colored border.
- [ ] **2.12 Dot detail / selection** — clicking a dot selects the person (shared selection state).

### Split view + timeline

- [ ] **2.13 Split-view layout** — resizable tree | map panes.
- [ ] **2.14 Selection sync** — shared selected-person state highlights/centers in both panes.
- [ ] **2.15 Timeline slider** — year slider; range auto-derived from event dates (+ manual override).
- [ ] **2.16 Slider drives map** — scrubbing recomputes dot positions live.
- [ ] **2.17 Subtle aging cue** — fade tree nodes for not-yet-born / deceased at slider year.
- [ ] **2.18 Play button** — animate the year sweep; dots move over time; play/pause/speed.

## Phase 3 — Historical map layer

- [ ] **3.1 Source historical-basemaps data** — fetch/vendor the GeoJSON border snapshots; document license.
- [ ] **3.2 Snapshot index** — map slider year → nearest available snapshot year.
- [ ] **3.3 Border layer render** — add boundary GeoJSON as a MapLibre layer beneath dots.
- [ ] **3.4 Border layer swap** — swap snapshot as slider crosses snapshot years (smooth-ish).
- [ ] **3.5 Country labels** — label historical entities (incl. vanished countries).
- [ ] **3.6 Basemap toggle** — toggle modern basemap on/off under the historical borders.
- [ ] **3.7 Styling pass** — period-appropriate border styling, opacity, fit with dots.

## Phase 4 — GEDCOM & polish

- [ ] **4.1 GEDCOM import — parse** — parse GEDCOM 5.5.1/7.0 into an intermediate structure.
- [ ] **4.2 GEDCOM import — map persons** — map individuals → persons (names, gender, notes).
- [ ] **4.3 GEDCOM import — map relationships** — families → partnerships + parent-child links.
- [ ] **4.4 GEDCOM import — map events/places** — events + place geocoding (queue manual review).
- [ ] **4.5 GEDCOM import — fuzzy dates** — translate GEDCOM date qualifiers → our fuzzy-date shape.
- [ ] **4.6 Import review UI** — preview/confirm before committing an import.
- [ ] **4.7 GEDCOM export** — serialize a tree back to valid GEDCOM.
- [ ] **4.8 Fuzzy-date input UX** — polished reusable date input (qualifier + precision).
- [ ] **4.9 Empty states & onboarding** — first-run guidance, sample/demo tree option.
- [ ] **4.10 Error handling & toasts** — consistent feedback for async actions.

## Deferred (revisit later)

- Living-person privacy redaction (needed if public sharing is added).
- Source citations on facts.
- Photo galleries + event/place photo attachment.
- Migration trail / path lines on the map.
- Raster scanned-map overlays.
- Public read-only share links.
