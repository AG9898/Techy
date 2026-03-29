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

# Neon pooled connection string from step 3
DATABASE_URL=postgresql://...?sslmode=require

# Leave empty — not implemented yet
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

Visit http://localhost:5173. You'll be redirected to `/auth/signin`. Click "Sign in with GitHub".

---

## 7. Type Check

```bash
npm run check
```

---

## Frontend Styling Notes

- Tailwind is configured through the Vite plugin in `vite.config.ts`
- Global Tailwind import and shared theme tokens live in `src/app.css`
- Root layout imports `src/app.css` from `src/routes/+layout.svelte`
- Melt UI is available for new interactive UI work; it does not provide Techy's final visual styling on its own
- GSAP is installed and available for future animation work, but it is not wired into any component by default

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in Vercel
3. Add all environment variables from `.env` in Vercel's project settings
4. Update the GitHub OAuth App callback URL to your Vercel production domain
5. Deploy — `adapter-auto` will detect Vercel automatically

**Note:** Use the Neon **pooled** connection string for the `DATABASE_URL` in production. The direct connection string does not work reliably in serverless environments.

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
| `AUTH_SECRET` errors | Run `openssl rand -hex 32` and set the output as `AUTH_SECRET` |
| D3 graph blank in production | Check browser console — likely a CSP issue with inline SVG |
| Wikilinks show as broken (red) | The linked note's title must match exactly — check capitalisation. See [`docs/NOTES.md`](NOTES.md). |

---

## Further Reading

- [`docs/NOTES.md`](NOTES.md) — Note schema, template, wikilink format, authoring rules
- [`docs/API.md`](API.md) — All routes, form actions, and API endpoints
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — System design and data flow
- [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) — High-level UI direction, theming, and motion rules
- [`docs/DECISIONS.md`](DECISIONS.md) — Why the stack was chosen
