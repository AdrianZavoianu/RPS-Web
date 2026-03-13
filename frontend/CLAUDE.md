# Frontend CLAUDE.md

React 18 + TypeScript + Vite + TanStack Query. See root [CLAUDE.md](../../CLAUDE.md) for project-wide guidance.

## Stack

| Layer | Tech |
|-------|------|
| UI | React 18, TypeScript 5 |
| Build | Vite 7, tsc |
| Routing | react-router-dom v6 |
| Server state | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Charts | Plotly.js + react-plotly.js |
| Client state | Zustand |
| Styling | Tailwind CSS v3 + semantic classes |
| Testing | Vitest + Testing Library + MSW |

## Dev Commands

```bash
npm run dev            # Dev server
npm test               # Vitest (run once)
npm run test:watch     # Watch mode
npm run lint           # ESLint (0 warnings allowed)
npm run build          # tsc + vite build
npm run build:ci       # build + bundle budget check
npm run build:analyze  # Bundle visualizer
```

## Source Layout

```
src/
├── api/           # Raw fetch functions (one file per domain)
├── hooks/         # React Query hooks wrapping api/ calls
├── stores/        # Zustand stores (authStore.ts)
├── types/         # Shared TypeScript types (index.ts)
├── pages/         # Route-level components
├── components/    # Feature components, grouped by domain
│   ├── results/   # All result display views and table
│   ├── charts/    # Plotly wrappers (ProfileChart, LazyPlot)
│   ├── projects/  # Project nav/browser
│   ├── imports/   # Import wizard
│   ├── exports/   # Export dialog
│   ├── reports/   # PDF report dialog
│   ├── comparisons/
│   ├── layout/
│   └── common/
├── features/      # Larger feature modules with own pages/hooks
│   ├── project-workspace/
│   └── results/
└── styles/        # structure.css (semantic class declarations)
```

## API & Data Fetching

API calls live in `api/` (raw fetch), consumed by `hooks/` (React Query).

```typescript
// hooks/queryKeys.ts — centralised query key factory
// hooks/invalidation.ts — cache invalidation helpers
// hooks/useResults.ts   — result data queries
// hooks/useImports.ts   — import job polling
// hooks/useExports.ts   — export job polling
// hooks/useReports.ts   — PDF report jobs
// hooks/useJobProgressTransport.ts — WebSocket progress bridge
// hooks/useWebSocket.ts — raw WS hook
```

Never fetch inside components — always go through hooks.

## Results View Architecture

`ResultsView.tsx` is the coordinator. It owns selection/hover state and passes it down.

```
pages/ProjectDetailPage.tsx
  └── ResultsView.tsx              # State coordinator
        ├── ResultsTable.tsx       # Interactive data table (TanStack Table)
        ├── ProfileChart.tsx       # MultiSeriesProfileChart / PushoverCurveChart
        ├── ElementResultsView.tsx
        ├── JointResultsView.tsx
        ├── MaxMinView.tsx
        ├── ComparisonView.tsx
        ├── TimeSeriesView.tsx
        └── PushoverView.tsx

components/results/results-view/
├── controller.ts          # Main controller hook
├── controller.data.ts     # Data fetching logic
├── controller.selection.ts # Selection state
├── controller.title.ts
├── controller.constants.ts
├── panelRegistry.tsx      # Maps result type → panel component
└── panels/                # Individual panel implementations
```

## Table-Chart Sync

`ResultsTable` and `MultiSeriesProfileChart` sync selection/hover via props from `ResultsView`:

- Header hover → column highlight
- Story cell hover → row highlight
- Value cell hover → bold cell only (no background)
- Selected load cases → full opacity / thick lines in chart
- Hovered load case → thickest line, others dimmed

## Styling Convention

Tailwind utilities for all layout/spacing/typography. Semantic class names go first in `className`:

```tsx
<div className="results-table-wrapper overflow-auto rounded border border-gray-200">
```

All semantic classes declared as empty selectors in `src/styles/structure.css`.

## State Rules

- Server state → TanStack Query (never useState for fetched data)
- Auth state → Zustand `authStore`
- UI-only transient state → useState local to component
- Lift state only when two+ siblings need it

## Charts

`ProfileChart.tsx` exports:
- `MultiSeriesProfileChart` — story-profile lines with selection/hover sync
- `PushoverCurveChart` — base shear vs displacement

`LazyPlot.tsx` wraps `react-plotly.js` with lazy loading to keep initial bundle small.

## Bundle Budget

Enforced via `bundle-budget.json` + `scripts/enforceBundleBudget.mjs` on `build:ci`.
Check before adding large new dependencies.
