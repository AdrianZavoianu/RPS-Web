# Phase 0 Baseline Report

- Generated at: 2026-02-18T06:01:06.773739+00:00
- Method: `scripts/capture_phase0_baseline.py`

## Frontend Bundle
- Asset files: 41
- Total assets (bytes): 1920431
- Total JS (bytes): 1592408
- Total CSS (bytes): 106780
- Largest asset: dist/assets/plotly-vendor-Rmh44YE8.js (1098900 bytes)

## Backend API Latency (ms)
- Global results read: avg=2.46, p95=3.33
- Comparison read: avg=4.41, p95=4.83
- Import start (kickoff): avg=8.2, p95=34.6
- Export start (kickoff): avg=28.69, p95=55.58

## Tree Expansion Probe
- Request count: 4
- Total latency (ms): 18.19
- Avg request latency (ms): 4.55

## Notes
- Import/Export metrics are start-endpoint kickoff latency baselines for Phase 0.
- Full background-job runtime baselines will be captured after stable fixture datasets are added.
