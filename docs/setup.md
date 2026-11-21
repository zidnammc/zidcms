# Setup

## 1. Local development (no external accounts)

Requirements: Node 26, pnpm 12 (`npm i -g pnpm@12.21.0`), Git.

```bash
pnpm install
pnpm init:local          # apps/admin/.env.local with random local secrets, PUBLISH_TARGET=local
pnpm dev:gas             # terminal 1 — GAS emulator http://localhost:8787/exec
pnpm dev:web             # terminal 2 — public site http://localhost:3001
pnpm dev:admin           # terminal 3 — admin http://localhost:3000 → "Dev login" as admin@example.com
pnpm seed                # optional sample content (then click "Publikasikan Situs")
pnpm smoke:local         # optional API-level end-to-end check
```

Reset everything local: stop the servers, delete `.local/`, run `pnpm reset:content`.

## 2. Production / staging resources (owner, Day 0)

Do each step once per environment (`dev`, then `prod` with approval). Keep every ID/URL/secret in your password manager — never in the repo, issues, or chat.

1. **GitHub** — public repo with this code; enable secret scanning + push protection. Create a fine-grained PAT: only this repo, _Contents: read & write_, _Commit statuses: read_.
2. **Google Sheets** — create an empty spreadsheet (e.g. "ZidCMS dev"). _Extensions → Apps Script_ creates a container-bound script.
3. **Apps Script** — enable the Apps Script API at <https://script.google.com/home/usersettings>. Install clasp (`npm i -g @google/clasp`), `clasp login`, then in `services/apps-script/` copy `.clasp.json.example` to `.clasp.json` (gitignored) with the script ID and `"rootDir": "dist"`.
4. **Script Properties** (_Project Settings → Script properties_): `HMAC_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `ENVIRONMENT` = `dev` or `prod`. Leave `MEDIA_FOLDER_ID` empty to let setup create a private folder.
5. **Deploy GAS** — see [deployment.md §1](deployment.md). Note the web-app URL. If Google answers the authorization with `Error 403: access_denied`, link the script to your own Google Cloud project first (_Project Settings → Change project_) and enable the Google Drive API there (deployment.md §1, steps 4–5).
6. **Initialise sheets** — put `GAS_WEBAPP_URL` and `GAS_HMAC_SECRET` into `apps/admin/.env.local`, then `pnpm setup:sheet` (calls `system.setup` + `system.health`). Alternatively run the `setup` function from the Apps Script editor once.
7. **Google OAuth client** — Google Cloud console → APIs & Services → OAuth consent screen _External_, scopes `openid email profile`; Credentials → OAuth client _Web application_; redirect URI `https://<admin-domain>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local testing).
8. **Vercel Hobby** — two projects from the same repo: root `apps/admin` and root `apps/web` (framework Next.js, install command `pnpm install --frozen-lockfile`). Set env vars per `.env.example` (admin, including `VERCEL_STATUS_CONTEXT=<web project name>`) and `SITE_URL` + `ZIDCMS_ENV` (web). A single-environment install uses `ZIDCMS_ENV=prod` on both projects and `GITHUB_BRANCH=main`; content is then published to `apps/web/content/prod/` on `main`.
9. **PoCs** (record outputs in `docs/status/`): `pnpm poc:gas` (PoC-1), `pnpm poc:sheets` (PoC-4), `pnpm poc:git` (PoC-2; requires `GITHUB_TOKEN`, `GITHUB_REPO`, `PUBLIC_SITE_URL`).

## 3. First sign-in

Open the admin URL, sign in with the Google account in `ADMIN_EMAILS`, create a post, publish, and watch the job reach _Tayang_.
