# 0007 — Monorepo tooling

- **Status:** accepted (2026-11-21).

## Decision

- pnpm 12.21.0 workspaces (`apps/*`, `packages/*`, `services/*`), no Turborepo. pnpm 12 blocks dependency build scripts by default; only `esbuild` is allowed (`allowBuilds` in `pnpm-workspace.yaml`).
- Node 26 LTS (`.nvmrc`, `engines`), `packageManager` pins pnpm.
- TypeScript 5.9.3 strict with `noUncheckedIndexedAccess`. TypeScript 7 (native) was available but not chosen: Next.js and tooling compatibility unverified.
- Biome 2.6.7 for lint + format (single tool) — no Next.js integration issues found.
- Vitest 5.1.0; Playwright and k6 are deferred to Day 5/6 (not yet installed).
- `@zidcms/core` is consumed as TypeScript source (`transpilePackages`), subpath exports keep the Markdown stack out of the GAS bundle.
- All dependencies pinned to exact versions published ≥ 7 days before 2026-11-21 (checked against the npm registry). Notable: Next 16.4.6, React 19.3.1, Tailwind 4.3.5, lucide-react 1.73.0, unified 11 / remark / rehype.
- GitHub Actions pinned to commit SHAs.
