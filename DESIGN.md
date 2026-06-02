# HeritageAtlas — Design Spec

A hosted web app for recording family ancestry (people, relationships, dates, photos) and
visualizing it as **a synced split view: a family graph alongside a historical map with a
timeline slider** that shows where the family was over the years — including countries that no
longer exist.

## Decisions (locked)

### Platform & stack
- **Hosted web app with accounts** (multi-user, shared database).
- **SvelteKit + TypeScript + Tailwind**.
- **Supabase** for Postgres + auth + file storage + row-level security.
- **MapLibre GL** for maps.
- Tree rendering: free-form pannable/zoomable auto-laid-out graph; planned layout engine **elkjs**,
  ranked by generation so it reads top-down rather than tangling.

### Accounts & sharing
- **Per-user trees + sharing.** Each account owns one or more trees.
- Role-based invites per tree: **owner / editor / viewer**.
- **Invite-only — no public links.** No anonymous access. Living-person redaction deferred
  (only trusted, invited family sees data).

### Data model
- **Custom Postgres schema** (tuned for map/timeline), with **GEDCOM import + export** for interop.
- **Full real-world relationship model:** partnerships (married or unmarried), multiple partners
  over a lifetime, same-sex couples, divorce/separation with dates, and typed parent-child links
  (biological / adoptive / step / foster).
- **Fuzzy dates with qualifiers:** value + qualifier (exact / about / before / after / between /
  estimated) and partial precision (year-only, month-year, full). Timeline resolves a best-guess
  point but tracks uncertainty.
- **Person record:** given name(s), surname, birth/maiden surname, nickname; sex/gender; free-text
  notes; **one profile photo** (used on dots & tree nodes); and a flexible list of **life events**.
- **Events:** birth, death, marriage, residence/moved, occupation, custom — each with a fuzzy date,
  a place, and a note. (No formal source citations in MVP.)
- **Places** are reusable entities (lat/long + name + optional historical name). Entered via
  type-ahead geocoding (OpenStreetMap/Nominatim) **with click-to-drop-pin fallback** for vanished
  or unfound places. Geocoded once, reused.

### Map & timeline
- **Position over time = event-based location timeline.** At slider-year T, a person's dot sits at
  the place of their most recent event ≤ T.
- **Dots:** no clustering. One dot per person = **profile photo (or initials) with a colored border
  keyed to surname** (everyone with the same last name shares a color).
- **Historical map = vector historical borders by year** (open dataset, e.g. the
  `historical-basemaps` GeoJSON project: snapshots like 1880/1900/1920/1945…). MapLibre swaps the
  boundary layer to the nearest snapshot year as you scrub. Modern street basemap underneath,
  toggleable. Labels vanished countries (Prussia, Austria-Hungary, Yugoslavia, …).
- **Timeline slider:** year granularity; range auto-derived from earliest/latest event dates
  (manual override); **play button** animates the sweep so dots migrate across the map.

### Interaction (synced split view)
- Tree on one side, map on the other.
- **Selection sync only:** selecting a person in one pane highlights & centers them in the other.
  (No hover sync, no viewport/filter sync.)
- The tree **stays static** during scrubbing, with a **subtle aging cue**: nodes for people
  not-yet-born or deceased at the slider year are faded/dimmed — no relayout.

## Build sequence
1. **Foundation (first):** auth, trees, people, relationships, person profiles, the family graph.
2. **Map basics:** events with places, dots layer, synced split view, timeline on a modern basemap.
3. **Historical layer:** vector borders by year, surname coloring, play animation.
4. **Polish:** GEDCOM import/export; fuzzy-date UI refinements.

## Open / deferred
- Living-person privacy redaction (deferred — revisit if public sharing is ever added).
- Source citations on facts (deferred to a later phase).
- Photo galleries + event/place photo attachment (MVP is one profile photo per person).
- Migration trails / path lines on the map (possible later add-on).
- Raster scanned-map overlays (vector borders only for now).
- Final tree-graph layout/library validation (elkjs is the working assumption).
