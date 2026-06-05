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

## Phase 3 — Landing, dashboard & onboarding

The product is map-first and single-tree by default; collaboration stays but quiet.
Flow: logged-out visitors get a marketing landing with a **live, interactive Windsor
demo**; logging in lands on a **dashboard hub**; brand-new users go through a guided
**"start with yourself"** wizard. (Decided 2026-06-05.)

- [x] **3.1 Routing & redirects** — `/` serves the landing only when logged out; logged-in hits to
      `/` redirect to `/dashboard`. Login/signup success → `/dashboard`; `/dashboard` with no tree →
      `/start`. Header: logged-out = logo + **Log in** / **Sign up**; logged-in = logo → `/dashboard` + account avatar menu (Account, Sign out). No header tree-switcher — switching happens on the
      dashboard.
- [x] **3.2 Landing page (`/`)** — hero (big title "Map your family across time", subtitle, primary
      CTA _Start your family tree_ → signup, secondary _Explore the demo_ → scroll to demo);
      **How it works** (3 steps: add family → add places & dates → watch them move); **feature
      highlights** (interactive tree, historical map, time-travel slider, GEDCOM import); **footer**
      (about, privacy, contact). Responsive.
- [x] **3.3 Windsor demo dataset** — seeded tree `windsor`: 34 people (George V/Battenberg branches →
      Prince George), 143 events incl. rich residence timelines for the travelers (Philip, the Windsors'
      exile, Mountbatten, the Sussexes' move to California), 41 geocoded places. Generated from
      `scripts/windsor-demo/build.mjs` → migration `0016`. 29 free-licensed portraits (PD/CC0/CC BY/
      BY-SA, verified per-file) in `static/demo/portraits/` + `CREDITS.md`; the 5 youngest use initials.
      Note: the public demo (3.5) must surface the CC-BY/BY-SA attributions.
- [x] **3.4 Public read access for the demo** — RLS policy so the single demo tree (and only it) is
      readable without auth; an unauthenticated loader path that serves it to the landing. (General
      per-tree public share links remain deferred.)
- [x] **3.5 Embedded live demo** — reuse the tree | map + timeline as a **read-only** embed on the
      landing (pan/zoom/scrub/select work; no edit affordances; "Open profile" hidden). Lazy-load
      MapLibre so it doesn't block first paint.
- [x] **3.6 Dashboard (`/dashboard`)** — tree card(s) with name, **mini-tree thumbnail**, **map
      preview thumbnail**, and **stats** (people · generations · places · year span) + _Open_; quick
      actions (Add person, Import GEDCOM [links to Phase 5 when ready], New tree); pending-invites
      banner. No-tree state → redirect to `/start`.
- [x] **3.7 On-this-day widget** — surface today's birth/death anniversaries from event dates on the
      dashboard ("Otto Brenner would turn 120 — b. 1906").
- [x] **3.8 Card thumbnails & stats** — derive the stat counts and render the mini-tree + static map
      preview used on dashboard cards (and reusable elsewhere).
- [x] **3.9 Onboarding wizard (`/start`)** — guided: (0) name your family tree (default "My Family")
      → create tree; (1) add yourself; (2) add parents; (3) add a partner; (4) add children; finish →
      the tree view. Steps skippable; reuses person/relationship creation.
- [x] **3.10 Tree Settings → Members** — surface invitations/roles quietly under Settings (invite by
      email, set role, remove); keep rename + danger zone; keep `/invitations` and the dashboard
      invite banner.
- [x] **3.11 Tree header nav** — `← Dashboard` + tree name on the tree and person pages.
- [x] **3.12 Account page** — confirm `/account` covers email, change password, sign out, delete
      account.

## Phase 4 — Historical map layer

- [ ] **4.1 Source historical-basemaps data** — fetch/vendor the GeoJSON border snapshots; document license.
- [ ] **4.2 Snapshot index** — map slider year → nearest available snapshot year.
- [ ] **4.3 Border layer render** — add boundary GeoJSON as a MapLibre layer beneath dots.
- [ ] **4.4 Border layer swap** — swap snapshot as slider crosses snapshot years (smooth-ish).
- [ ] **4.5 Country labels** — label historical entities (incl. vanished countries).
- [ ] **4.6 Basemap toggle** — toggle modern basemap on/off under the historical borders.
- [ ] **4.7 Styling pass** — period-appropriate border styling, opacity, fit with dots.

## Phase 5 — GEDCOM & polish

- [ ] **5.1 GEDCOM import — parse** — parse GEDCOM 5.5.1/7.0 into an intermediate structure.
- [ ] **5.2 GEDCOM import — map persons** — map individuals → persons (names, gender, notes).
- [ ] **5.3 GEDCOM import — map relationships** — families → partnerships + parent-child links.
- [ ] **5.4 GEDCOM import — map events/places** — events + place geocoding (queue manual review).
- [ ] **5.5 GEDCOM import — fuzzy dates** — translate GEDCOM date qualifiers → our fuzzy-date shape.
- [ ] **5.6 Import review UI** — preview/confirm before committing an import (reachable from the
      dashboard "Import GEDCOM" action).
- [ ] **5.7 GEDCOM export** — serialize a tree back to valid GEDCOM.
- [ ] **5.8 Fuzzy-date input UX** — polished reusable date input (qualifier + precision).
- [ ] **5.9 Error handling & toasts** — consistent feedback for async actions.

## Deferred (revisit later)

- Living-person privacy redaction (needed if public sharing is added).
- Source citations on facts.
- Photo galleries + event/place photo attachment.
- Migration trail / path lines on the map.
- Raster scanned-map overlays.
- General per-tree public read-only share links (beyond the single hard-coded demo tree in 3.4).
- **Perceived performance / snappiness** — CRUD interactions feel slow because each one is a full
  Supabase round-trip + reload. Load a tree's graph/map data once and keep it in an in-browser store,
  serving subsequent navigations/interactions from memory and applying edits optimistically (revalidate
  in the background). Goal: instant-feeling tree/map/timeline interaction.
- **Internationalization (i18n)** — extract UI strings and support multiple languages (and locale-aware
  date formatting) at some point.
- **Testing** — unit tests (pure logic: fuzzyDate, positionResolver, markerLayout, layout helpers) and
  end-to-end tests (Playwright: auth, onboarding, add-person, timeline scrub) with a CI gate.

## Pre-launch checklist

- [ ] **Re-enable "Confirm email"** in Supabase (Authentication → Providers → Email).
      It was turned off during development for password sign-up without SMTP; turn it
      back on (and configure SMTP) before any real users sign up.
- [ ] **Enable leaked-password protection** (Authentication → Policies) so Supabase checks
      passwords against HaveIBeenPwned. Flagged by the security advisor.
