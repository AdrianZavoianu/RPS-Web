# Backend Instructions

This subtree implements the backend.

## Stack & Structure
- Follow existing backend patterns; do not introduce alternate frameworks.
- Keep business logic out of controllers/views; use service-layer functions/modules.

## Data & Safety
- No schema/migration changes without explicit approval.
- Preserve data integrity; avoid irreversible operations.
- Heavy computation and business logic belong here (not frontend).

## Tests (recommended)
- When changing core logic, add/update a minimal targeted test if a harness exists.
