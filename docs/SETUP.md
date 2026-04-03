# Setup Guide — Techy

## Prerequisites

- Node.js 20+
- A GitHub account (for OAuth)
- A Neon account (free tier: https://neon.tech)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd Techy
npm install
```

The repo includes:
- Tailwind CSS v4 via `@tailwindcss/vite`
- Melt UI for headless Svelte 5 UI primitives
- GSAP for optional motion and animation work

No extra Tailwind init command is required. The Tailwind entrypoint lives at `src/app.css`.

---

## 2. GitHub OAuth App

Create an OAuth App at https://github.com/settings/developers → "OAuth Apps" → "New OAuth App"

| Field | Value |
|-------|-------|
| Application name | Techy (or anything) |
| Homepage URL | `http://localhost:5173` (dev) or your prod URL |
| Authorization callback URL | `http://localhost:5173/auth/callback/github` |

Copy the **Client ID** and generate a **Client Secret**.

For production, create a second OAuth App with the production domain, or update the callback URL.

---

## 3. Neon Database

1. Sign in at https://console.neon.tech
2. Create a new project (PostgreSQL 16)
3. From the dashboard, copy the **pooled connection string** (not the direct one)
   - It looks like: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`

---

## 4. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Generate with: openssl rand -hex 32
AUTH_SECRET=<your-secret>

GITHUB_CLIENT_ID=<from-step-2>
GITHUB_CLIENT_SECRET=<from-step-2>

# Your GitHub username — only this account can log in
ALLOWED_GITHUB_USERNAME=<your-github-username>

# Optional debug bypass for local and agent-driven Playwright testing
# Set this to true only when you want the bypass available
DEBUG_AUTH_BYPASS_ENABLED=true

# Use the same strong secret locally and in Vercel if you want the agent to access both
DEBUG_AUTH_BYPASS_SECRET=<long-random-secret>

# Optional display name shown in the app when using the bypass
DEBUG_AUTH_BYPASS_NAME=Agent

# Neon pooled connection string from step 3
DATABASE_URL=postgresql://...?sslmode=require

# Required for assistant/provider work once the assistant-first phase lands
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## 5. Database Migrations

```bash
# Generate migration SQL from schema
npm run db:generate

# Apply migrations to Neon
npm run db:migrate
```

Migrations are output to `drizzle/`. Commit them.

---

## 6. Run Development Server

```bash
npm run dev
```

Visit http://localhost:5173. You'll be redirected to the standalone `/signin` page. After sign-in, you'll enter the protected app shell.

---

## 7. Type Check

```bash
npm run check
```

## 8. Run Unit Tests

```bash
npm run test
```

Use `npm run test:watch` while iterating locally.

---

## 9. Normalize Legacy Note Categories

Use the repo-local backfill script only when you intentionally want to clean up older note rows that were saved before the canonical category taxonomy landed:

```bash
npm run normalize:note-categories -- --apply
```

The command is a dry run unless `--apply` is provided. It rewrites only safe legacy category labels, keeps tags and bodies unchanged, and prints ambiguous or unknown categories for manual review.

---

## Frontend Styling Notes

- Tailwind is configured through the Vite plugin in `vite.config.ts`
- Global Tailwind import and shared theme tokens live in `src/app.css`
- Root layout imports `src/app.css` from `src/routes/+layout.svelte`
- Melt UI is available for new interactive UI work; it does not provide Techy's final visual styling on its own
- GSAP is installed and currently wired into restrained chat and nav motion; keep any new usage scoped to meaningful state transitions

---

## Deployment (Vercel)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. In **Project Settings → Environment Variables**, add every variable from `.env`:

   | Variable | Notes |
   |----------|-------|
   | `AUTH_SECRET` | Generate with `openssl rand -hex 32` |
   | `GITHUB_CLIENT_ID` | From your production GitHub OAuth App |
   | `GITHUB_CLIENT_SECRET` | From your production GitHub OAuth App |
   | `ALLOWED_GITHUB_USERNAME` | Your GitHub login (case-sensitive) |
   | `DEBUG_AUTH_BYPASS_ENABLED` | Optional. Set to `true` only when you want the debug bypass available |
   | `DEBUG_AUTH_BYPASS_SECRET` | Optional. Strong shared secret for local and deployed debug login |
   | `DEBUG_AUTH_BYPASS_NAME` | Optional. Display name for the debug session, e.g. `Agent` |
   | `DATABASE_URL` | Neon **pooled** connection string (see below) |
   | `AUTH_TRUST_HOST` | Set to `true` — required on Vercel so Auth.js trusts the host header |

4. Create a second GitHub OAuth App (or update the existing one) with:
   - **Callback URL:** `https://<your-vercel-domain>/auth/callback/github`
5. Click **Deploy** — `adapter-auto` detects Vercel automatically

**Important:** Use the Neon **pooled** connection string for `DATABASE_URL` in production. The direct connection string does not work reliably in serverless environments.

**Build note:** The build requires `DATABASE_URL` to be set in the Vercel environment variables — the DB client is initialised at module load time. Vercel injects env vars into the build, so this works automatically once the variable is configured.

**Env-loading note:** App server modules use SvelteKit's private env access, while standalone tooling such as `drizzle.config.ts` still reads from plain Node environment variables. Keep running Drizzle commands from the repo root so `.env` is loaded as expected.

### Debug Bypass

For agent-driven Playwright testing, Techy can mint a signed debug session without going through GitHub OAuth.

1. Set `DEBUG_AUTH_BYPASS_ENABLED=true`
2. Set a long random `DEBUG_AUTH_BYPASS_SECRET`
3. Use the same secret in your local `.env` and Vercel if you want the agent to work against both environments
4. Hit `/debug/auth/login` with the secret and an optional `redirectTo`

Example:

```bash
curl -i "http://localhost:5173/debug/auth/login?secret=<DEBUG_AUTH_BYPASS_SECRET>&redirectTo=/notes"
```

This bypass is app-level, not GitHub-level. It does not use your personal GitHub password, OAuth token, or browser session.

---

## Database Studio (optional)

```bash
npm run db:studio
```

Opens Drizzle Studio at http://local.drizzle.studio — a GUI for browsing and editing the database.

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `DATABASE_URL environment variable is not set` | `.env` file missing or not loaded |
| `AccessDenied` on GitHub sign-in | `ALLOWED_GITHUB_USERNAME` doesn't match your GitHub login (case-sensitive) |
| Debug bypass returns `404` | `DEBUG_AUTH_BYPASS_ENABLED` is not set to `true` |
| Debug bypass returns `403` | `DEBUG_AUTH_BYPASS_SECRET` is missing or does not match |
| `AUTH_SECRET` errors | Run `openssl rand -hex 32` and set the output as `AUTH_SECRET` |
| CSRF / bad request errors on Vercel sign-in | `AUTH_TRUST_HOST` env var not set to `true` in Vercel settings |
| D3 graph blank in production | Check browser console — likely a CSP issue with inline SVG |
| Wikilinks show as broken (red) | The linked note's title must match exactly — check capitalisation. See [`docs/NOTES.md`](NOTES.md). |

---

## Further Reading

- [`docs/NOTES.md`](NOTES.md) — Note schema, template, wikilink format, authoring rules
- [`docs/schema.md`](schema.md) — Database tables, relationships, and persistence boundaries
- [`docs/API.md`](API.md) — All routes, form actions, and API endpoints
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — System design and data flow
- [`docs/test.md`](test.md) — Test commands, scope, and CI pipeline
- [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) — High-level UI direction, theming, and motion rules
- [`docs/DECISIONS.md`](DECISIONS.md) — Why the stack was chosen
