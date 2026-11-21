# AGENTS.md — working notes for AI agents and contributors

Source of truth for scope and acceptance: `ZIDCMS_EXECUTION_PLAN.md`. Decisions: `docs/decisions/`.

## Toolchain

- Node 26 (`.nvmrc`), pnpm 12 (`packageManager`). pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (not `onlyBuiltDependencies`).
- Next.js 16 (Turbopack). APIs differ from older versions — read `node_modules/next/dist/docs/` before changing framework code. `params`/`searchParams` are Promises. `output: 'export'` rejects empty `generateStaticParams()`, hence the `__zidcms-empty__` placeholder in `apps/web/lib/site.ts`.
- `agentRules: false` is set in both `next.config.ts` files so `next dev` does not generate per-app AGENTS.md files.
- Tailwind CSS 4 (CSS-first config in `app/globals.css`), Biome 2 for lint + format, Vitest 5.

## Commands

| Task                                   | Command                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Install                                | `pnpm install`                                                                      |
| Lint / format                          | `pnpm lint` / `pnpm format`                                                         |
| Typecheck                              | `pnpm typecheck`                                                                    |
| Unit + contract tests                  | `pnpm test`                                                                         |
| Build everything                       | `pnpm build` (core has no build; GAS bundle → `services/apps-script/dist`)          |
| Static-output check                    | `pnpm check:web` (after build)                                                      |
| Secret scan                            | `pnpm scan:secrets` (bundles) / `pnpm scan:secrets --repo` (tracked files)          |
| Local stack                            | `pnpm dev:gas` (emulator :8787) + `pnpm dev:admin` (:3000) + `pnpm dev:web` (:3001) |
| End-to-end smoke (local stack running) | `pnpm smoke:local`                                                                  |
| Reset published content to empty v0    | `pnpm reset:content`                                                                |
| PoCs against real services             | `pnpm poc:gas`, `pnpm poc:sheets`, `pnpm poc:git`                                   |

## Rules that are easy to break

- The repo is public: never commit `.env*` (except `.env.example`), `.clasp.json`, GAS URLs/IDs, spreadsheet/Drive IDs, or the admin e-mail. Tests use `@example.com`.
- Before committing, run `pnpm reset:content` unless you intend to commit a published snapshot (only the publisher does that).
- Shell heredocs longer than ~10 KB get truncated by the agent tool; write large files with the file-write tool.
- Do not add comments unless asked; `biome-ignore` directives are allowed where a rule is intentionally bypassed.
- UI copy is Bahasa Indonesia (owner decision); docs and code identifiers are English.
