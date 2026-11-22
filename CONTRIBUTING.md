# Contributing to ZidCMS

Thanks for your interest in ZidCMS. This guide explains how to set up the project, what to check before opening a pull request, and the conventions we follow.

## Project status

ZidCMS is at an early stage (v0.1.x). It is maintained by the project owner, and contributions are welcome through issues and pull requests. For anything larger than a small fix, please open an issue first so we can agree on the approach before you spend time on it.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before taking part. Security problems follow the [Security policy](SECURITY.md), not public issues.

## Prerequisites

- Node.js 26 (see `.nvmrc`)
- pnpm 12.21.0 (`npm install -g pnpm@12.21.0`)
- Git

No Google, GitHub or Vercel account is needed for local development: a built-in emulator stands in for Google Sheets and Apps Script.

## Local setup

```bash
git clone https://github.com/zidnammc/zidcms.git
cd zidcms
pnpm install
pnpm init:local      # creates apps/admin/.env.local with random local keys
```

Start the three parts, each in its own terminal:

```bash
pnpm dev:gas         # terminal 1: Sheets + Apps Script emulator (http://localhost:8787)
pnpm dev:web         # terminal 2: public site (http://localhost:3001)
pnpm dev:admin       # terminal 3: admin dashboard (http://localhost:3000)
```

Open <http://localhost:3000>, type `admin@example.com` in the **Dev login** box and click **Masuk** (Sign in). Run `pnpm seed` for optional sample content. To start over, stop the servers, delete the `.local/` folder and run `pnpm reset:content`.

## Project layout

See [Repository layout](README.md#repository-layout) in the README. In short: shared domain logic lives in `packages/core`, the Apps Script backend and its emulator in `services/apps-script`, the admin dashboard in `apps/admin`, the static public site in `apps/web`, and tooling in `scripts` and `tests`. Architecture and decisions are documented in [`docs/architecture.md`](docs/architecture.md) and [`docs/decisions/`](docs/decisions/).

## Quality gates

Run these before opening a pull request. They are the same steps CI runs in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:web
pnpm scan:secrets
```

Optional, with the local emulator stack (recommended for changes to the publish flow, the RPC layer or the admin UI):

```bash
pnpm test:integration
pnpm test:e2e
```

Before committing, run `pnpm reset:content` so that local publish output is not included. See [`docs/testing.md`](docs/testing.md) for details.

## Conventions

- **TypeScript strict** everywhere.
- **Biome** for linting and formatting (`pnpm format`, or `pnpm exec biome check --write .`).
- **Conventional Commits** for commit messages and PR titles (for example `fix(admin): keep draft on save error`).
- **Small, focused pull requests.** One change per PR is easier to review.
- **Tests for behavior changes.** Bug fixes should come with a test that fails without the fix.
- **Language:** UI copy is in Bahasa Indonesia; code identifiers, comments and documentation are in English.
- **Dependencies:** do not add a new dependency without a one-line justification in the PR description. Its license must be compatible with Apache-2.0.

## Never commit secrets

The repository is public. Never commit:

- secrets, tokens or keys of any kind;
- `.env*` files (except `.env.example`);
- Apps Script deployment URLs or IDs, Google Drive IDs or spreadsheet IDs;
- personal e-mail addresses (tests and examples use `@example.com`).

`pnpm scan:secrets --repo` checks tracked files. If a secret is committed by accident, rotate it immediately: removing it from history is not enough once it has been public.

## How releases work

Pull requests are merged into `main`, which carries code only and creates no deployments. The maintainer promotes `main` to `release` after CI and the emulator-stack checks pass, and `release` deploys production. See [`docs/deployment.md`](docs/deployment.md) for details.

## License of contributions

ZidCMS is licensed under the [Apache License, Version 2.0](LICENSE). By submitting a contribution you agree that it is licensed under the same terms (Apache-2.0, section 5). There is no Contributor License Agreement (CLA).
