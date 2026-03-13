# Backend CLAUDE.md

Django 5 + DRF + Celery + Channels. See root [CLAUDE.md](../../CLAUDE.md) for project-wide guidance.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Django 5.2, DRF 3.16 |
| Async tasks | Celery 5.6 + Redis |
| WebSockets | Django Channels 4.3 + channels-redis |
| DB | PostgreSQL via psycopg3 |
| Auth | JWT (simplejwt) |
| Data | numpy, pandas, openpyxl |
| PDF | WeasyPrint |
| Schema | drf-spectacular (OpenAPI) |

## Dev Commands

```bash
python manage.py runserver
celery -A rps worker -l info
celery -A rps beat -l info        # Scheduled tasks (if needed)
pytest
black . && flake8 && isort .
python manage.py migrate
python manage.py shell_plus       # django-extensions
```

## App Architecture

```
apps/
├── projects/     # Core models: Project, Story, LoadCase, Element
├── results/      # Result data, API views, providers, serializers
├── importer/     # Upload → parse → cache pipeline
├── exporter/     # Export jobs (Excel/CSV)
├── reporting/    # PDF report generation
├── catalog/      # Project catalog and browsing
└── users/        # Auth, user management
```

## Key Patterns

### Service Layer
Business logic lives in `services/`, never in views. Views call services; services call models/providers.

```
results/services/
├── result_service.py       # ResultDataService — primary query interface
├── availability_service.py # What result types/directions exist
├── data_assembler.py       # Assembles multi-provider responses
├── datasets.py             # Dataset abstractions
├── fallback_policy.py      # Missing data handling
├── pushover_service.py
├── tree_metadata_service.py
└── providers/              # Per-result-type data fetchers
    ├── global_provider.py
    ├── element_provider.py
    ├── joint_provider.py
    ├── comparison_provider.py
    ├── maxmin_provider.py
    ├── beam_provider.py
    └── column_provider.py
```

### Import Pipeline
```
importer/services/
├── start.py               # Entry point: validate + dispatch job
├── upload.py              # File handling
├── prescan.py             # Sheet detection
├── import_context.py      # Shared state across pipeline steps
├── runner_pipeline.py     # Orchestrates step execution
├── cache_builder.py       # CacheBuilderService (post-import)
└── cache_builders/        # Per-type cache writers
    ├── global_cache_builder.py
    ├── element_cache_builder.py
    ├── joint_cache_builder.py
    └── time_series_cache_builder.py

importer/parsers/
├── excel_parser.py        # ExcelParser — sheet parsing entry point
├── base.py
├── sheets/                # Per-sheet parsers
└── transformers.py
```

### Views
`results/views/` is split by result type — one file per domain:
`global_views.py`, `element_views.py`, `joint_views.py`, `comparison_views.py`,
`chart_views.py`, `pushover_views.py`, `beam_views.py`, `column_views.py`,
`set_views.py`, `metadata_views.py`.

Shared logic in `mixins.py`.

## Settings

`rps/settings/` — environment-split settings. Use `python-decouple` + `.env` for secrets.

## WebSocket / Progress

Celery tasks push progress events via Channels. See:
- `importer/consumers.py`, `importer/routing.py`
- `exporter/consumers.py`
- `reporting/consumers.py`

## Result Type Config

`config/result_types.py` — `RESULT_TYPE_CONFIG` defines unit multipliers:
Drifts=100 (%), Accelerations=1 (g), Forces=1 (kN), Displacements=1000 (mm).

## Models (projects app)

`Project` → `ResultSet` → `Story` / `LoadCase` / `Element`

Result data stored in dedicated model tables per result type (see `results/models/`):
`GlobalResult`, `ElementResult`, `JointResult`, `PushoverResult`, `CacheTable`.

## Guardrails

- No schema changes without explicit approval — always use migrations
- No raw SQL unless a Django ORM query is truly impossible
- Use `select_related`/`prefetch_related` to prevent N+1
- Celery tasks must be idempotent
