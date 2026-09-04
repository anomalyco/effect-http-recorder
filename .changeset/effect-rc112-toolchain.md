---
"effect-http-recorder": minor
---

Upgrade to Effect `4.0.0-rc.112`, require TypeScript 7 and Bun `1.4.1` or newer, and update the development toolchain to TypeScript `7.0.2`, `@effect/tsgo` `0.39.1`, and Vitest `4.1.11`.

Adapt schema errors, JSON codecs, and WebSocket types to the updated dependencies while preserving the recorder API and cassette format. Remove the obsolete `skipLibCheck` workaround from consumer guidance and package verification.
