# FormTrack

Lead capture forms that show business owners exactly where their leads came from — independently of what their marketing agency tells them.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript strict**
- **Supabase** (Postgres + Row Level Security + Realtime)
- **SCSS modules** on top of CSS custom property tokens (dark-first + auto light)
- **Stripe** self-serve billing
- **SendGrid** transactional email
- **Google + Microsoft OAuth** for connected inboxes
- **Vitest** (unit + integration) + **Playwright** (E2E)
- **esbuild** for the standalone embed script (`embed/`)
- **Vercel** hosting

## Getting started

```bash
npm install
cp .env.example .env.local          # fill in Supabase + provider keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright E2E |
| `npm run embed:build` | Build the standalone `ft.js` embed script |
| `npm run embed:watch` | Watch mode for the embed script |

## Architecture

```
app/            Thin Next.js App Router — route groups for (marketing), (auth), (app)
src/
  features/     Feature-sliced UI + hooks (dashboard, forms, leads, billing, …)
  shared/       design/, components/, layout/, hooks/, utils/
  domain/       Pure TS — Form, Lead, Attribution, Workspace. Zero framework deps.
  infrastructure/ Supabase, Stripe, SendGrid, OAuth clients. Only place that touches SDKs.
  services/     Cross-feature orchestration
  types/        Generated Supabase types
embed/          Standalone esbuild workspace (vanilla JS, ~<10KB)
supabase/       migrations/ + seed.sql
tests/          unit/ (Vitest) + e2e/ (Playwright)
```

Rules:

1. `app/` routes are thin — they import a `*Screen` component from `src/features/*/ui/screens`.
2. `domain/` has no framework imports. Business rules (e.g. `resolveAttribution`) are pure and unit-tested.
3. `infrastructure/` is the only place that talks to external SDKs. One place to swap SendGrid → Resend later.
4. Every tenant-owned table has `workspace_id` + RLS policies. The `service_role` Supabase client lives only in `infrastructure/supabase/admin.ts` and is used only by webhooks and cron jobs.

## Multi-tenant security model

- Every tenant-owned table is column-scoped: `workspace_id uuid not null`.
- Every such table has `row level security enabled` and `force row level security`.
- Policies match `auth.jwt() ->> 'workspace_id'`, set on login via a Supabase auth hook.
- All `workspace_id` columns are indexed.
- Route handlers call `requireWorkspace()` to fail closed if the JWT claim is missing — defense in depth.

Full schema lands in **build step 2**. See `CHECKPOINT.md` for progress.

## Build order

This project follows a 13-step build order (see `CHECKPOINT.md`). Each step ships with passing tests and a checkpoint entry before the next begins.

## License

Proprietary. All rights reserved.
