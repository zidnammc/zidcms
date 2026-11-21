# 0006 — Apps Script code organization and tooling

- **Status:** accepted (2026-11-21).

## Decision

- Pure domain logic in `packages/core` (no Node/GAS APIs on the GAS code path).
- GAS code depends on ports (`services/apps-script/src/ports.ts`): `SheetStore`, `MediaStore`, `NonceStore`, `Lock`, `Props`, `Runtime`. GAS adapters wrap `SpreadsheetApp`, `DriveApp`, `CacheService`, `LockService`, `PropertiesService`, `Utilities`; in-memory adapters (`memory.ts`) back contract tests and the local emulator.
- esbuild bundles `src/gas/main.ts` into one IIFE (`dist/Code.js`, target ES2019, ~73 KiB) and appends top-level `doPost`/`doGet`/`setup` wrappers; the build fails if the bundle references Node APIs.
- **No Zod.** `packages/core/src/validate.ts` provides plain validators (unknown keys rejected) shared by admin and GAS — keeps the GAS bundle small and avoids a runtime dependency.
- Container-bound script; manifest scopes `spreadsheets.currentonly` + `drive.file`; web app `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS` **[NV enum values and drive.file behaviour with DriveApp]**. Fallback scope: `drive`.
- Every write takes the script lock (`tryLock(10 s)` → `LOCK_TIMEOUT`), reads the sheet once, checks `expected_version` and slug uniqueness, writes one row, appends Revision + AuditLog rows, then `SpreadsheetApp.flush()`.
- Cells are written with number format `@` and an escape codec: values starting with `= + - @ ' ~ \t \r` are prefixed with `~` on write and unescaped on read (bijective; TC-DATA-02). PoC-4 will show whether plain-text formatting alone would suffice; the escape stays as defence in depth.
- Always redeploy to the same deployment ID; GAS keeps ≤ 200 versions.

## Local emulator

`pnpm dev:gas` runs the real dispatcher over HTTP with file-persisted in-memory sheets (`.local/gas-dev/state.json`) and emulates GAS's POST → 302 → GET response flow.
