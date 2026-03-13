# Phase 0 Contract Matrix

Scope date: 2026-02-17  
Plan source: `RPS_APP_GENERAL_REFACTOR_PLAN.md` (Phase 0)

## Critical Flow Contracts

| Flow | Endpoint | Preconditions | Success Contract | Failure Contract | Coverage |
|---|---|---|---|---|---|
| Auth login | `POST /api/auth/login/` | Valid username/password | `200` with `access`, `refresh`, `user` | `401` for invalid credentials | Automated smoke (`test_login_smoke`) |
| Results read | `GET /api/projects/{slug}/results/global/` | Authenticated owner, `result_set_id`, `result_type`, `direction` query params | `200` with `rows`, `meta`, `load_case_columns` | `400` for missing params | Automated smoke (`test_results_read_smoke`) |
| Comparison read | `GET /api/projects/{slug}/results/comparison/` | Authenticated owner, `result_set_ids`, `result_type` query params | `200` with `rows`, `series`, `warnings` | `400` for invalid request shape | Automated smoke (`test_comparison_read_smoke`) |
| Import start job | `POST /api/projects/{slug}/imports/{job_id}/start/` | Authenticated owner, pending import job, prescan data present | `200` with `detail`, `task_id`, `job_id` | `400` for invalid state/payload | Automated smoke (`test_import_start_smoke`) |
| Export start job | `POST /api/projects/{slug}/exports/` | Authenticated owner, valid export request payload | `201` with created job payload | `400` for invalid request payload | Automated smoke (`test_export_start_smoke`) |
| Report generation job | `POST /api/projects/{slug}/reports/generate/` | Authenticated owner, valid `result_set_id`, non-empty `sections` | `200` PDF response | `400` for invalid payload, `404` for missing result set, `500` generation failure | Manual checklist (Phase 0) |

## Non-Regression Checklist

- Login returns JWT access and refresh tokens.
- Global result read returns a typed dataset payload, not raw model rows.
- Comparison read handles multiple result sets and returns series metadata.
- Import start returns task metadata and persists queued task id.
- Export start returns job metadata and persists queued task id.
- Reporting failures log correlation context with stable keys.
- Error responses include standardized envelope fields:
  - `error.code`
  - `error.message`
  - `error.status`
  - `error.correlation_id`
- Importer/exporter/reporting logs use standardized fields:
  - `project_id`
  - `project_slug`
  - `job_type`
  - `job_id`
  - `result_set_id`
  - `task_id` (when available)

## Smoke Execution

- Local:
  - `DJANGO_SETTINGS_MODULE=rps.settings.test python -m pytest apps/importer/tests/test_api_smoke.py`
- CI:
  - Workflow: `.github/workflows/ci.yml`
  - Job step: `Backend smoke and refactor guards`
