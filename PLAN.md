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

- [x] **1.1 Supabase Auth setup** — enable email auth; document required env/keys.
- [x] **1.2 Sign up / sign in / sign out** — auth pages + session handling (SSR-safe).
- [x] **1.3 Route protection** — redirect unauthenticated users; load session in root layout.
- [x] **1.4 Profile bootstrap** — `profiles` table + trigger/row on first login; minimal account page.

### Schema (one migration per small group; all with RLS)

- [x] **1.5 `trees` table** — id, name, owner_id, timestamps + RLS (owner full access).
- [x] **1.6 `tree_members` table** — tree_id, user_id, role (owner/editor/viewer) + RLS for shared access.
- [x] **1.7 `persons` table** — names (given, surname, birth/maiden, nickname), sex/gender, notes,
      profile_photo_path, tree_id + RLS via tree membership.
- [x] **1.8 `relationships`** — split into `partnerships` (current/former status only) and
      `parent_child_links` (plain parent → child). Edges reference persons + RLS. (Simplified in
      migration 0009 — no dates/type; relationships only show in the tree, never on the map.)
- [x] **1.9 Fuzzy-date storage convention** — decide & document columns (value + qualifier + precision);
      reusable shape for **event** dates (Phase 2). The shape/formatter live in `src/lib/fuzzyDate.ts`.
- [x] **1.10 Generate TS types** — Supabase type generation wired to a script; commit generated types.

### Tree CRUD

- [x] **1.11 Tree list page** — list trees the user owns/belongs to; create-tree form.
- [x] **1.12 Tree settings** — rename/delete tree (owner only); show members.
- [x] **1.13 Invite members** — invite by email, assign role; accept flow.

### Persons CRUD

- [x] **1.14 Add person** — form for names + gender + notes; create within a tree.
- [x] **1.15 Edit / delete person** — edit form; safe delete (relationship edges cascade via FK).
- [x] **1.16 Profile photo upload** — Supabase Storage bucket + upload, set as profile photo. (Crop deferred.)
- [x] **1.17 Person detail panel** — read view: names, photo, gender, notes, relationships summary.

### Relationships UI

- [x] **1.18 Add partnership** — link two persons as partners; set current/former status.
- [x] **1.19 Add parent-child** — link a child to parent(s).
- [x] **1.20 Relationship editing/removal** — toggle partnership status; remove links.

### Family graph

- [x] **1.21 Graph data loader** — query persons + relationships for a tree into a graph structure.
- [x] **1.22 elkjs layout** — feed nodes/edges to elkjs, rank by generation, get positioned coords.
      Uses the union-node model (couples share a hidden junction) so layered layout puts partners
      on the same rank and children below.
- [x] **1.23 Render nodes** — pan/zoom SVG nodes matching the Figma design: cloud "blob" with
      photo/initials + a name card coloured by sex (sage male / clay female / cream other).
- [x] **1.24 Render edges** — parent-child + partnership connectors; former partnerships dashed.
- [x] **1.25 Node selection** — click a node → selected state + detail panel (photo, sex, open profile).
- [x] **1.26 Surname color map** — `src/lib/surnameColor.ts`, deterministic shared util. NOT applied
      to graph nodes (would be confusing); reserved for the map dots in Phase 2.
- [x] **1.27 Graph perf pass** — pan/zoom via a single root transform (no node re-render); level-of-
      detail fallback to plain blocks when zoomed far out; batched photo signing in the loader.

## Phase 2 — Map basics

### Places & events schema

- [x] **2.1 `places` table** — name, historical_name, lat, lng, source (geocoded/manual) + RLS.
      Tree-scoped (unique (id, tree_id)) so events can composite-FK (place_id, tree_id); lat/lng
      nullable for not-yet-located places, range-checked. Migration 0011.
- [x] **2.2 `events` table** — `person_id`, type, fuzzy date (`event_*` columns, per `fuzzyDate.ts`),
      `place_id` (FK on delete set null), `label` (for custom), note + RLS. Composite FKs keep the
      person and place in the event's tree. Migration 0012.
- [x] **2.3 Event types enum/config** — `src/lib/events.ts`: `EventType`, ordered `EVENT_TYPES`
      with display metadata (label, icon, `locates` flag for the map resolver) + label helpers.

### Place entry

- [x] **2.4 Geocoding search** — server-side Nominatim proxy (`/api/geocode`, policy-compliant
      User-Agent) behind a debounced, abortable `GeocodeSearch` type-ahead with OSM attribution.
- [x] **2.5 Pin-drop fallback** — `PinDropMap` (MapLibre + OSM raster style, `src/lib/map/style.ts`)
      lets the user name an unfindable/vanished place and click the map for coords (`source=manual`).
- [x] **2.6 Place reuse** — `PlaceSelection` + server `findOrCreatePlace` (reuses a same-name place
      within ~100m to avoid duplicate geocodes). `PlacePicker` composes existing-place reuse + the
      geocode search + pin-drop, emitting a selection the host form resolves.

### Events UI

- [x] **2.7 Add/edit event on person** — new/edit/delete routes with a shared `EventForm`
      (type, `FuzzyDateInput`, `PlacePicker`, note). Server `parseEventForm` folds the date parts
      into the fuzzy-date columns and resolves the place via `findOrCreatePlace`. `fuzzyDate.ts`
      gained `fuzzyDateFromParts`/`fuzzyDateToParts` for the year/month/day input ↔ storage bridge.
- [x] **2.8 Events list on person detail** — chronological section (icon · label · fuzzy date ·
      place), ordered by the lower-bound date with undated events last; add/edit entry points.

### Map view

- [x] **2.9 MapLibre base map** — `MapView.svelte`: OSM raster basemap (reuses `src/lib/map/style.ts`),
      pan/zoom + navigation control, client-only dynamic MapLibre import. Fits the viewport to the dots.
- [x] **2.10 Position resolver** — `src/lib/map/positionResolver.ts`: `resolvePositions(persons, year)` →
      each person at the place of their most recent locating event with year ≤ target (people with no
      event yet are omitted). Loader groups located events per person, ascending, with a same-year
      type tiebreak (birth→death). `src/lib/map/types.ts` holds the shared shapes.
- [x] **2.11 Dots layer** — one MapLibre marker per located person: avatar (photo/initials) with a
      surname-coloured ring (`surnameColor`), reconciled in place so a year scrub moves dots.
- [x] **2.12 Dot detail / selection** — `selectedId` state shared into `MapView` (so other panes can
      highlight later); clicking a dot selects + opens a detail card (event icon · place · year ·
      open-profile link), clicking the empty map clears it.

### Split view + timeline

- [x] **2.13 Split-view layout** — resizable tree | map panes (`SplitPane.svelte`, draggable divider,
      remembered ratio). New `/trees/[treeId]/explore` route; shared `loadTreeViewData` feeds both panes.
- [x] **2.14 Selection sync** — shared `selectedId` highlights + smoothly centers the person in both
      panes (tree tweens to the node, map eases to the dot); a shared banner covers the off-map case.
- [x] **2.15 Timeline slider** — `Timeline.svelte`: year slider with a painted fill; range auto-derived
      from the tree's dated facts (located events + birth/death), with a manual From/To override + reset.
- [x] **2.16 Slider drives map** — scrubbing `year` re-resolves positions; markers reconcile in place.
- [x] **2.17 Subtle aging cue** — tree nodes for the not-yet-born / already-deceased fade at the slider year.
- [x] **2.18 Play button** — rAF year sweep (years/second, consistent wall-clock), play/pause, 1×/2×/4×;
      stops at the range end and restarts from the start on replay.

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

## Pre-launch checklist

- [ ] **Re-enable "Confirm email"** in Supabase (Authentication → Providers → Email).
      It was turned off during development for password sign-up without SMTP; turn it
      back on (and configure SMTP) before any real users sign up.
- [ ] **Enable leaked-password protection** (Authentication → Policies) so Supabase checks
      passwords against HaveIBeenPwned. Flagged by the security advisor.
