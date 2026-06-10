# Build Notes

## 2026-06-10 foundation pass

Initial repository foundation created.

Added:

- README
- product charter
- Fable 5 execution brief
- architecture document
- threat model
- data model
- QEV upstream reference
- roadmap
- pnpm workspace
- strict TypeScript base config
- shared domain types
- core verification utilities
- demo envelope adapter

Important choices:

- The first product is not a full marketplace. It is the lock/license/verify commerce primitive.
- The phrase `piracy-proof` is forbidden.
- Demo envelope behavior is allowed only when clearly labeled as not production cryptography.
- Existing QEV work should be referenced through an adapter boundary rather than blindly copied.
- The package boundary for asset envelopes is `packages/envelope`.

Next expected action:

- Validate workspace install/typecheck/build.
- Add `apps/web` with minimal Vite React shell.
- Add local lifecycle demo using `@my-digital/types`, `@my-digital/core`, and `@my-digital/envelope`.
