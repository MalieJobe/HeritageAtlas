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

| Variable                          | Where to find it                                          |
| --------------------------------- | --------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | Supabase dashboard → Project Settings → API → Project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → "publishable" key           |

Both are public (browser-safe) values; `.env` itself is git-ignored.

### Auth & database setup

Email/password auth is enabled by default on new Supabase projects. For local dev,
turn **off** "Confirm email" (Authentication → Providers → Email) so sign-ups work
without an SMTP server, or leave it on and check the inbox.

Database schema lives in [supabase/migrations/](supabase/migrations/). Apply it with
the Supabase CLI (`supabase db push`) or by pasting each migration into the dashboard
SQL editor, in filename order.

## Scripts

| Command          | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `pnpm dev`       | Start the dev server                                          |
| `pnpm build`     | Production build                                              |
| `pnpm preview`   | Preview the production build                                  |
| `pnpm check`     | Type-check (`svelte-check`)                                   |
| `pnpm lint`      | Prettier check + ESLint                                       |
| `pnpm format`    | Auto-format with Prettier                                     |
| `pnpm gen:types` | Regenerate Supabase DB types into `src/lib/supabase/types.ts` |

`gen:types` needs the [Supabase CLI](https://supabase.com/docs/guides/cli) and an
access token (`supabase login`, or set `SUPABASE_ACCESS_TOKEN`). The generated file
is kept verbatim and is exempt from lint/format.
