# 0005: Public site: Next.js static export

- **Status:** accepted (2026-11-21).

## Decision

- `apps/web`: `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`, `dynamicParams = false`, `generateStaticParams` on every dynamic route. `sitemap.ts`/`robots.ts` are `force-static` metadata routes (emitted as files). No route handlers, middleware, server actions, ISR, or runtime env reads (`SITE_URL` is read at build time only).
- Markdown is rendered at build time with `@zidcms/core/markdown#renderMarkdown`; the admin preview and the editor's live preview use the same function.
- Builds succeed with the shipped empty snapshot (version 0).
- **Adjustment:** Next.js 16 refuses `output: 'export'` when `generateStaticParams()` returns `[]` (verified on 2026-11-21). Dynamic routes therefore return a single placeholder param `__zidcms-empty__` when empty; that path renders the `noindex` 404 page and is never linked or listed in the sitemap.
- Dark mode follows `prefers-color-scheme` (no client JS needed); the admin uses a class-based toggle.

## Evidence

- `pnpm --filter @zidcms/web build` with the empty snapshot (TC-WEB-01) and `pnpm check:web` (TC-WEB-02: only static file types in `out/`).
