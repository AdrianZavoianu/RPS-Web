# Phase 0 Baseline Runbook

Use this runbook to regenerate the Phase 0 baseline artifact after major backend/frontend changes.

## Prerequisites

- Frontend dependencies installed in `frontend/node_modules`.
- Backend dependencies installed in `backend/.venv`.
- Required env vars exported:
  - `SECRET_KEY`
  - `DB_CORE_NAME`
  - `DB_USER`
  - `DB_PASSWORD`

## Command

From `RPS-App/`:

```bash
backend/.venv/bin/python scripts/capture_phase0_baseline.py
```

## Outputs

- Markdown report: `docs/refactor/phase-0-baseline-report.md`
- JSON payload: `docs/refactor/phase-0-baseline-report.json`

## Baseline Scope

- Frontend bundle size (total and largest chunk)
- Backend API latency:
  - results read
  - comparison read
  - import start kickoff
  - export start kickoff
- Tree expansion request probe:
  - request count
  - aggregate latency
