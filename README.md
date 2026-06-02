# HeritageAtlas

A hosted web app for recording family ancestry — people, relationships, dates, and photos — and
visualizing it as a **synced split view**: an interactive family graph beside a **historical map
with a timeline slider** that shows where the family lived across the years, including borders of
countries that no longer exist.

See [DESIGN.md](DESIGN.md) for the full design spec and [PLAN.md](PLAN.md) for the task-by-task
build plan.

## Stack

- **SvelteKit** (Svelte 5) + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — Postgres, auth, file storage, row-level security
- **MapLibre GL** — maps (added in Phase 2)
- **pnpm** package manager · Node version pinned in [.nvmrc](.nvmrc)

## Getting started

```sh
pnpm install
cp .env.example .env   # then fill in your Supabase values
pnpm dev
```

### Environment variables

Copy [.env.example](.env.example) to `.env` and set:

| Variable                   | Where to find it                            |
| -------------------------- | ------------------------------------------- |
| `PUBLIC_SUPABASE_URL`      | Supabase dashboard → Project Settings → API |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |

Both are public (browser-safe) keys; `.env` itself is git-ignored.

## Scripts

| Command        | Description                  |
| -------------- | ---------------------------- |
| `pnpm dev`     | Start the dev server         |
| `pnpm build`   | Production build             |
| `pnpm preview` | Preview the production build |
| `pnpm check`   | Type-check (`svelte-check`)  |
| `pnpm lint`    | Prettier check + ESLint      |
| `pnpm format`  | Auto-format with Prettier    |
