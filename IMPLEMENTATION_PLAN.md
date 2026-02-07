# RPS Web Application - Implementation Plan

## Overview

Convert RPS desktop application (PyQt6 + SQLite) to a web application using **React + Tailwind + Django + PostgreSQL + Celery**, maintaining full feature parity and visual design fidelity.

---

## Target Architecture

### Backend Stack
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Django 5.x + DRF | REST APIs, ORM, admin |
| Database | PostgreSQL 16+ | Primary data store with JSONB support |
| Task Queue | Celery + Redis | Long-running imports/exports |
| Real-time | Django Channels (WebSocket) or SSE | Progress updates |
| File Storage | S3/MinIO (prod) / Local (dev) | Excel uploads, generated exports |
| Time-series | PostgreSQL JSONB or TimescaleDB | High-volume time histories |

### Frontend Stack
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 + TypeScript | UI framework |
| Build | Vite | Fast development builds |
| Styling | Tailwind CSS 3.x | Design system implementation |
| Data Fetching | TanStack Query (React Query) | Server state + caching |
| Tables | TanStack Table | Large data grids with virtualization |
| Charts | Plotly.js | Building profiles, animations, interactivity |
| Routing | React Router 6 | SPA navigation |

### Architecture Principles
- **Layered design**: UI → Service → Repository (mirrors desktop)
- **3-panel layout**: Tree browser (25%) + Content area (75%)
- **View parity**: Standard, Comparison, Max/Min, Pushover, Time-Series, Reporting
- **Design fidelity**: DESIGN.md tokens → Tailwind theme + CSS variables

---

## Database & Storage Strategy

### PostgreSQL Schema Design

**Key Changes from Desktop:**
- Single database with `project_id` FK on all tables (replaces per-project SQLite)
- Composite indexes for query paths used in views and exports
- JSONB columns for wide-format cache data

**Performance Optimizations:**
```sql
-- Partition large result tables by project_id
CREATE TABLE story_drifts (
    id BIGSERIAL,
    project_id INTEGER NOT NULL,
    story_id INTEGER NOT NULL,
    load_case_id INTEGER NOT NULL,
    direction VARCHAR(10),
    drift DOUBLE PRECISION,
    ...
) PARTITION BY HASH (project_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_drifts_result_set_type_dir
ON story_drifts (result_set_id, direction)
INCLUDE (story_id, drift);

-- Materialized view for export aggregations
CREATE MATERIALIZED VIEW mv_project_drift_summary AS
SELECT project_id, result_set_id, direction,
       MAX(drift) as max_drift, MIN(drift) as min_drift, AVG(drift) as avg_drift
FROM story_drifts
GROUP BY project_id, result_set_id, direction;
```

### Models (27 Tables)

| Category | Tables |
|----------|--------|
| **Catalog** | CatalogProject (separate from per-project data) |
| **Core** | Project, Story, LoadCase, Element |
| **Result Sets** | ResultSet, ResultCategory, ComparisonSet |
| **Global Results** | StoryDrift, StoryAcceleration, StoryForce, StoryDisplacement |
| **Element Results** | WallShear, QuadRotation, ColumnShear, ColumnAxial, ColumnRotation, BeamRotation |
| **Joint Results** | SoilPressure, VerticalDisplacement |
| **Pushover** | PushoverCase, PushoverCurvePoint |
| **Cache** | GlobalResultsCache, ElementResultsCache, JointResultsCache, AbsoluteMaxMinDrift, TimeSeriesGlobalCache |

### Cache Strategy
- **Keep desktop cache tables**: Wide format with JSONB for fast tabular display
- **JSONB arrays** in `time_series_global_cache` for time-step data
- **Optional TimescaleDB**: For projects with very high-volume time histories (>100k points per story)
- **Materialized views**: For common export aggregations, refreshed on import completion

### File Storage
```
uploads/
├── {project_slug}/
│   ├── imports/
│   │   ├── {job_id}/           # Uploaded Excel files
│   │   │   ├── file1.xlsx
│   │   │   └── file2.xlsx
│   │   └── ...
│   └── exports/
│       ├── {timestamp}_results.xlsx
│       └── {timestamp}_report.pdf
```

- **Development**: Local filesystem (`./media/`)
- **Production**: S3/MinIO with presigned URLs for downloads
- **Metadata in DB**: filename, checksum (SHA256), size, upload timestamp

---

## Project Structure

```
rps-web/
├── docker-compose.yml              # Dev stack (postgres, redis, minio)
├── docker-compose.prod.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── manage.py
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── dev.txt
│   │   └── prod.txt
│   │
│   ├── rps/                        # Django project
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── celery.py
│   │   ├── asgi.py                 # Channels
│   │   └── wsgi.py
│   │
│   ├── apps/
│   │   ├── users/                  # Authentication & user management
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   │
│   │   ├── catalog/                # Project catalog (list, metadata)
│   │   │   ├── models.py           # CatalogProject
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   │
│   │   ├── projects/               # Per-project core data
│   │   │   ├── models.py           # Project, Story, LoadCase, Element
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── managers.py
│   │   │   └── urls.py
│   │   │
│   │   ├── results/                # Result data & caches
│   │   │   ├── models/
│   │   │   │   ├── result_sets.py
│   │   │   │   ├── global_results.py
│   │   │   │   ├── element_results.py
│   │   │   │   ├── joint_results.py
│   │   │   │   ├── pushover.py
│   │   │   │   └── cache.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   └── services/
│   │   │       ├── result_service.py
│   │   │       ├── comparison_builder.py
│   │   │       └── maxmin_builder.py
│   │   │
│   │   ├── importer/               # Import processing
│   │   │   ├── models.py           # ImportJob
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   ├── tasks.py            # Celery tasks
│   │   │   ├── consumers.py        # WebSocket progress
│   │   │   ├── parsers/
│   │   │   │   ├── excel_parser.py
│   │   │   │   └── transformers.py
│   │   │   └── services/
│   │   │       ├── import_preparation.py
│   │   │       ├── folder_importer.py
│   │   │       ├── conflict_resolver.py
│   │   │       └── cache_builder.py
│   │   │
│   │   ├── exporter/               # Export functionality
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   ├── tasks.py
│   │   │   └── services/
│   │   │       ├── excel_exporter.py
│   │   │       └── csv_exporter.py
│   │   │
│   │   └── reporting/              # PDF reports
│   │       ├── views.py
│   │       ├── urls.py
│   │       └── services/
│   │           └── pdf_generator.py
│   │
│   ├── core/                       # Shared utilities
│   │   ├── mixins.py
│   │   ├── permissions.py
│   │   ├── pagination.py
│   │   └── exceptions.py
│   │
│   └── config/                     # Ported from desktop
│       ├── result_types.py         # ResultTypeConfig definitions
│       └── visual_config.py
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js          # Design tokens from DESIGN.md
│   │
│   ├── public/
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css               # Tailwind + CSS variables
│       │
│       ├── api/                    # API client layer
│       │   ├── client.ts           # Axios instance
│       │   ├── projects.ts
│       │   ├── results.ts
│       │   ├── imports.ts
│       │   └── exports.ts
│       │
│       ├── hooks/                  # React Query hooks
│       │   ├── useProjects.ts
│       │   ├── useResults.ts
│       │   ├── useImport.ts
│       │   └── useWebSocket.ts
│       │
│       ├── components/
│       │   ├── ui/                 # Design system
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Select.tsx
│       │   │   ├── Checkbox.tsx
│       │   │   ├── Dialog.tsx
│       │   │   ├── Table.tsx
│       │   │   ├── Tree.tsx
│       │   │   ├── Tabs.tsx
│       │   │   └── Splitter.tsx
│       │   │
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   ├── Header.tsx
│       │   │   └── Sidebar.tsx
│       │   │
│       │   ├── projects/
│       │   │   ├── ProjectGrid.tsx
│       │   │   ├── ProjectCard.tsx
│       │   │   └── CreateProjectDialog.tsx
│       │   │
│       │   ├── results/
│       │   │   ├── ResultsTreeBrowser.tsx
│       │   │   ├── StandardResultView.tsx
│       │   │   ├── ComparisonResultView.tsx
│       │   │   ├── MaxMinView.tsx
│       │   │   ├── PushoverCurveView.tsx
│       │   │   └── TimeSeriesAnimatedView.tsx
│       │   │
│       │   ├── tables/
│       │   │   ├── ResultsTable.tsx
│       │   │   └── GradientCell.tsx
│       │   │
│       │   ├── charts/
│       │   │   ├── BuildingProfile.tsx
│       │   │   ├── PushoverCurve.tsx
│       │   │   ├── ComparisonChart.tsx
│       │   │   └── TimeSeriesPlayer.tsx
│       │   │
│       │   ├── imports/
│       │   │   ├── ImportDialog.tsx
│       │   │   ├── FileUploader.tsx
│       │   │   ├── LoadCaseSelector.tsx
│       │   │   ├── ConflictResolver.tsx
│       │   │   └── ImportProgress.tsx
│       │   │
│       │   └── exports/
│       │       ├── ExportDialog.tsx
│       │       └── ReportPreview.tsx
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── ProjectsPage.tsx
│       │   ├── ProjectDetailPage.tsx
│       │   └── SettingsPage.tsx
│       │
│       ├── stores/                 # Zustand for UI state
│       │   ├── uiStore.ts
│       │   └── importStore.ts
│       │
│       ├── types/
│       │   ├── project.ts
│       │   ├── results.ts
│       │   └── api.ts
│       │
│       └── utils/
│           ├── colors.ts
│           ├── formatting.ts
│           └── gradients.ts
│
├── scripts/
│   ├── migrate_sqlite_to_postgres.py
│   └── seed_demo_data.py
│
└── tests/
    ├── backend/
    │   └── ...
    └── e2e/
        └── ...
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/login/              # JWT token pair
POST   /api/auth/logout/             # Invalidate refresh token
POST   /api/auth/refresh/            # Refresh access token
GET    /api/auth/user/               # Current user info
```

### Catalog & Projects
```
GET    /api/catalog/                 # List all projects (paginated)
POST   /api/catalog/                 # Create project entry
GET    /api/catalog/{slug}/          # Get project metadata
PATCH  /api/catalog/{slug}/          # Update metadata
DELETE /api/catalog/{slug}/          # Delete project

GET    /api/projects/{slug}/summary/ # Project summary stats
GET    /api/projects/{slug}/stories/
GET    /api/projects/{slug}/load-cases/
GET    /api/projects/{slug}/elements/?type=Wall
```

### Result Sets & Data
```
GET    /api/projects/{slug}/result-sets/
POST   /api/projects/{slug}/result-sets/
DELETE /api/projects/{slug}/result-sets/{id}/

# Main data endpoints (paginated, filterable)
GET    /api/projects/{slug}/results/global/
       ?result_set_id=1&result_type=Drifts&direction=X
GET    /api/projects/{slug}/results/element/
       ?result_set_id=1&element_id=5&result_type=WallShears&direction=V2
GET    /api/projects/{slug}/results/joint/
       ?result_set_id=1&result_type=SoilPressures_Min
GET    /api/projects/{slug}/results/maxmin/
       ?result_set_id=1&base_type=Drifts
GET    /api/projects/{slug}/results/time-series/
       ?result_set_id=1&load_case=TH02&result_type=Drifts&direction=X
```

### Pushover
```
GET    /api/projects/{slug}/pushover-cases/?result_set_id=1
GET    /api/projects/{slug}/pushover-cases/{id}/curve-points/
```

### Comparisons
```
GET    /api/projects/{slug}/comparison-sets/
POST   /api/projects/{slug}/comparison-sets/
DELETE /api/projects/{slug}/comparison-sets/{id}/
GET    /api/projects/{slug}/comparisons/
       ?comparison_set_id=1&result_type=Drifts&direction=X&metric=Max
```

### Import
```
POST   /api/projects/{slug}/imports/upload/           # Upload files
POST   /api/projects/{slug}/imports/prescan/          # Discover load cases
POST   /api/projects/{slug}/imports/start/            # Start import job
GET    /api/projects/{slug}/imports/{job_id}/status/  # Poll status
DELETE /api/projects/{slug}/imports/{job_id}/         # Cancel job
WS     /ws/imports/{job_id}/                          # Real-time progress
```

### Export
```
POST   /api/projects/{slug}/exports/excel/            # Generate Excel
POST   /api/projects/{slug}/exports/csv/              # Generate CSV
POST   /api/projects/{slug}/exports/pdf-report/       # Generate PDF
GET    /api/projects/{slug}/exports/{job_id}/status/
GET    /api/projects/{slug}/exports/{job_id}/download/
```

---

## Implementation Phases

### Phase 1: Discovery & Parity Map (Week 1)

**Goal**: Audit desktop flows and define acceptance criteria.

- [ ] Document all desktop workflows:
  - Import: Standard, Foundation, Pushover, Time-Series
  - Export: Excel, CSV, PDF
  - Views: Standard, Comparison, Max/Min, Pushover, Time-Series
  - Reporting: PDF generation with preview
- [ ] Define acceptance tests using sample files from `test_input/`
- [ ] Create feature parity checklist
- [ ] Document edge cases and conflict resolution rules

**Deliverable**: Acceptance test suite specification

---

### Phase 2: Backend Foundation (Weeks 2-4)

**Goal**: Set up Django infrastructure with all models.

**Backend Tasks:**
- [ ] Django project scaffolding with settings split
- [ ] PostgreSQL setup with docker-compose
- [ ] User model and JWT authentication
- [ ] All 27 database models with migrations
- [ ] Service layer boundaries defined
- [ ] Basic CRUD APIs for catalog and projects
- [ ] API pagination, filtering, error handling
- [ ] Celery + Redis setup
- [ ] File upload infrastructure (local/S3)

**Testing:**
- [ ] Model unit tests
- [ ] API endpoint tests

**Deliverable**: All models migrated, basic project CRUD working

---

### Phase 3: Import/Processing Pipeline (Weeks 5-7)

**Goal**: Full import functionality with conflict resolution.

**Backend Tasks:**
- [ ] Port ExcelParser from desktop (`processing/excel_parser.py`)
- [ ] Port result transformers (`processing/result_transformers.py`)
- [ ] ImportJob model with status tracking
- [ ] Prescan service (load case discovery, conflict detection)
- [ ] Conflict resolution logic
- [ ] Foundation joint propagation
- [ ] Standard import Celery task
- [ ] Pushover import (curves + results)
- [ ] Time-series import
- [ ] Cache builders (global, element, joint, time-series)
- [ ] WebSocket consumer for progress updates
- [ ] Job status endpoints

**Testing:**
- [ ] Import tests with sample Excel files
- [ ] Conflict resolution tests
- [ ] Cache building validation

**Deliverable**: Full import matching desktop functionality

---

### Phase 4: API Layer Complete (Week 8)

**Goal**: All data retrieval endpoints for frontend.

**Backend Tasks:**
- [ ] Port ResultDataService (`services/result_service/service.py`)
- [ ] Comparison builder service
- [ ] MaxMin builder service
- [ ] Paginated data endpoints for tables
- [ ] Aggregate endpoints for plots
- [ ] Export discovery endpoint (available types)
- [ ] API documentation (drf-spectacular/Swagger)

**Testing:**
- [ ] Service layer tests
- [ ] API response validation

**Deliverable**: Complete API ready for frontend integration

---

### Phase 5: Frontend Build (Weeks 9-13)

**Goal**: React application with full UI parity.

**Week 9-10: Foundation**
- [ ] Vite + React + TypeScript setup
- [ ] Tailwind config with DESIGN.md tokens
- [ ] Design system components (Button, Card, Input, Dialog, etc.)
- [ ] API client with Axios
- [ ] TanStack Query setup
- [ ] Login page
- [ ] Projects page with card grid
- [ ] Create/delete project dialogs

**Week 11: Import UI**
- [ ] File upload component (drag-drop)
- [ ] Import dialog flow
- [ ] Load case selector with checkboxes
- [ ] Conflict resolution dialog
- [ ] WebSocket progress indicator
- [ ] Import summary view

**Week 12: Results Views**
- [ ] 3-panel layout with splitter
- [ ] Tree browser (NLTHA/Pushover/Comparisons)
- [ ] Results table with gradient coloring
- [ ] Building profile chart (Plotly)
- [ ] Standard result view (table + plot)
- [ ] Element result views
- [ ] Joint result views
- [ ] Max/Min envelope views

**Week 13: Advanced Views**
- [ ] Comparison views with multi-series
- [ ] Pushover curve view
- [ ] Time-series animated view with playback
- [ ] Export dialog
- [ ] Report preview

**Testing:**
- [ ] Component tests (Vitest + Testing Library)
- [ ] Visual regression tests

**Deliverable**: Full UI with feature parity

---

### Phase 6: QA, Performance & Release (Weeks 14-16)

**Goal**: Production-ready application.

**QA:**
- [ ] End-to-end tests (Playwright) for critical flows
- [ ] Regression tests with golden datasets
- [ ] Cross-browser testing
- [ ] Accessibility audit

**Performance:**
- [ ] Database query optimization (EXPLAIN ANALYZE)
- [ ] Add missing indexes
- [ ] Large project stress tests (1000+ load cases)
- [ ] Frontend bundle optimization
- [ ] Chart performance with large datasets

**Infrastructure:**
- [ ] Docker production configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] SSL/TLS configuration
- [ ] Backup strategy

**Documentation:**
- [ ] Deployment guide
- [ ] API documentation
- [ ] User guide

**Data Migration:**
- [ ] SQLite → PostgreSQL migration utility
- [ ] Validation scripts
- [ ] Rollback procedures

**Deliverable**: Production deployment

---

## Critical Files to Port

| Desktop File | Web Location | Purpose |
|--------------|--------------|---------|
| `database/models/*.py` | `backend/apps/*/models.py` | All 27 Django models |
| `services/result_service/service.py` | `backend/apps/results/services/` | ResultDataService |
| `services/result_service/comparison_builder.py` | `backend/apps/results/services/` | Comparison logic |
| `processing/excel_parser.py` | `backend/apps/importer/parsers/` | Excel parsing |
| `processing/result_transformers.py` | `backend/apps/importer/parsers/` | Data transformation |
| `processing/import_preparation.py` | `backend/apps/importer/services/` | Prescan, conflicts |
| `processing/enhanced_folder_importer.py` | `backend/apps/importer/services/` | Batch import |
| `config/result_config.py` | `backend/config/result_types.py` | Result type config |
| `DESIGN.md` | `frontend/tailwind.config.js` | Design tokens |
| `gui/styles.py` | `frontend/src/index.css` | CSS variables |

---

## Design System (Tailwind Config)

```javascript
// frontend/tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background layers
        'bg-primary': '#0a0c10',
        'bg-secondary': '#161b22',
        'bg-tertiary': '#1c2128',
        'bg-hover': 'rgba(255, 255, 255, 0.03)',

        // Text
        'text-primary': '#d1d5db',
        'text-secondary': '#9ca3af',
        'text-muted': '#7f8b9a',
        'text-accent': '#67e8f9',

        // Accent
        'accent-primary': '#4a7d89',
        'accent-secondary': '#67e8f9',
        'accent-hover': 'rgba(74, 125, 137, 0.18)',
        'accent-selected': 'rgba(74, 125, 137, 0.12)',

        // Borders
        'border-default': '#2c313a',
        'border-subtle': 'rgba(255, 255, 255, 0.05)',

        // Semantic
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontSize: {
        xs: '12px',
        sm: '13px',
        base: '14px',
        md: '16px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
      },
      borderRadius: {
        card: '8px',
        'project-card': '12px',
        input: '6px',
        button: '999px',
      },
    },
  },
};
```

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Single DB with FK isolation** | Simpler ops than schema-per-project; standard Django pattern |
| **Separate catalog app** | Clean separation between project list and per-project data |
| **Celery for imports** | Required for large files; enables progress tracking |
| **WebSocket for progress** | Real-time updates without polling |
| **Cache tables retained** | Essential for fast table rendering; proven in desktop |
| **Plotly for charts** | Best match for building profiles and time-series animation |
| **TanStack Query** | Server state management with smart caching; simpler than Redux |
| **JSONB for wide data** | PostgreSQL native; efficient for cache tables |
| **S3/MinIO for files** | Scalable file storage; presigned URLs for downloads |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large file uploads (>100MB) | Chunked uploads, client-side validation, timeout handling |
| Long import jobs (>10min) | Celery with retries, job resumption, clear status updates |
| Performance with large datasets | Pagination, virtualization, server-side caching, query optimization |
| Chart performance | Plotly WebGL renderer, data downsampling for >10k points |
| Session timeout during work | Token refresh, auto-save, unsaved changes warning |
| Migration data loss | Validate against desktop, test thoroughly, keep SQLite backups |
| Browser compatibility | Test in Chrome, Firefox, Edge; polyfills as needed |

---

## Success Criteria

1. **Feature Parity**: All desktop features working in web version
2. **Visual Fidelity**: UI matches DESIGN.md specifications
3. **Performance**:
   - Page load < 2s
   - Table render < 500ms for 1000 rows
   - Import 10 files < 60s
4. **Reliability**:
   - Import success rate > 99%
   - No data loss during migration
5. **Usability**:
   - Same workflows as desktop
   - Clear progress indicators
   - Helpful error messages
