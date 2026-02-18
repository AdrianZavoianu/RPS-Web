# Phase 0 Baseline Report

- Generated at: 2026-02-17T08:03:15Z
- Method:
  - Frontend bundle: `npm run build`
  - Bundle byte totals: `find dist/assets ...`
  - Backend baseline probes: blocked in this environment (details below)

## Frontend Bundle

- Asset files: `40`
- Total assets (bytes): `1916462`
- Total JS (bytes): `1588439`
- Total CSS (bytes): `106780`
- Largest asset: `frontend/dist/assets/plotly-vendor-_KaW0dHB.js` (`1098900` bytes)

## Backend Baseline Probe Status

- Status: `blocked`
- Blocker:
  - Python runtime in this environment is missing backend dependencies (`django`, `celery`).
  - Network access is restricted, so `pipenv sync --dev` could not install required packages.
- Impact:
  - API latency baseline
  - tree expansion request probe
  - import/export kickoff latency

## Next Capture Command (when backend deps are present)

From `RPS-App/`:

```bash
backend/.venv/bin/python scripts/capture_phase0_baseline.py
```
