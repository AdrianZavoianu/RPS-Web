# Frontend Instructions

This subtree implements the frontend UI.

## UI Contract
- `DESIGN.md` is authoritative for UI patterns and visual language.
- Reuse existing components and conventions before creating new variants.

## Styling
- Semantic class first, Tailwind utilities second.
- Keep reusable components readable; avoid huge utility-only chains.

## Computation Boundary
- Frontend handles presentation and light transforms only.
- Heavy computation and business logic belong on the backend.
