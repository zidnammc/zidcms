# 0004: Media: private Drive origin, published copies in the build

- **Status:** accepted (2026-11-21). PoC-3 pending a real Drive folder.

## Decision

- Upload path: browser → `POST /api/media` (admin auth, Origin check, `content-length` and `File.size` ≤ 3 MB, magic-byte sniffing, sha256) → GAS `media.upload` (base64) which re-validates mime allowlist, size, magic bytes, and **re-computes sha256** before writing to Drive.
- Allowed: JPEG, PNG, WebP, GIF. SVG and anything whose bytes do not match the declared type are rejected (`UNSUPPORTED_MEDIA_TYPE`). Filenames are sanitized.
- Deduplication by sha256 among non-deleted media.
- Width/height parsed cheaply from headers (PNG, GIF, WebP VP8/VP8L/VP8X, JPEG SOF).
- ZidCMS never changes Drive sharing. `system.setup` creates a private folder `ZidCMS Media (<env>)` when `MEDIA_FOLDER_ID` is empty. `DriveApp` requires the full `drive` scope (verified 2026-11-21, see ADR-0006).
- Publish copies exactly the referenced set to `apps/web/content/<env>/media/<sha256>.<ext>` (served as `/media/…`, ADR-0011); unreferenced files are deleted in the same commit. Media paths use the full sha256 (the prototype used a 16-char prefix).
- Admin previews stream bytes through `GET /api/media/:id/preview` (admin-only, `private` cache, sandbox CSP).
