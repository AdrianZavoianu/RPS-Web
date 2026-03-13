#!/usr/bin/env python3
"""Capture a reproducible Phase 0 baseline report for refactor tracking."""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


REQUIRED_ENV_VARS = (
    "SECRET_KEY",
    "DB_CORE_NAME",
    "DB_USER",
    "DB_PASSWORD",
)


@dataclass(frozen=True)
class ProbeFixture:
    username: str
    password: str
    project_slug: str
    global_result_set_id: int
    comparison_result_set_ids: tuple[int, int]
    import_job_id: int


def _percentile(values: list[float], p: int) -> float:
    if not values:
        raise ValueError("Cannot compute percentile for empty sample set")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]

    position = (len(ordered) - 1) * (p / 100)
    lower_index = int(math.floor(position))
    upper_index = int(math.ceil(position))
    if lower_index == upper_index:
        return ordered[lower_index]

    lower_value = ordered[lower_index]
    upper_value = ordered[upper_index]
    weight = position - lower_index
    return lower_value + ((upper_value - lower_value) * weight)


def _summarize_latency(samples: list[float]) -> dict[str, float | int]:
    if not samples:
        raise ValueError("Cannot summarize empty latency samples")
    return {
        "count": len(samples),
        "min_ms": round(min(samples), 2),
        "avg_ms": round(statistics.fmean(samples), 2),
        "p50_ms": round(_percentile(samples, 50), 2),
        "p95_ms": round(_percentile(samples, 95), 2),
        "max_ms": round(max(samples), 2),
    }


def _require_environment() -> None:
    missing = [name for name in REQUIRED_ENV_VARS if not os.getenv(name)]
    if missing:
        missing_csv = ", ".join(missing)
        raise RuntimeError(
            "Missing required environment variables for Django settings bootstrap: "
            f"{missing_csv}"
        )


def _run_frontend_build(frontend_dir: Path) -> None:
    subprocess.run(
        ["npm", "run", "build"],
        cwd=frontend_dir,
        check=True,
    )


def _collect_bundle_metrics(frontend_dir: Path) -> dict[str, object]:
    assets_dir = frontend_dir / "dist" / "assets"
    if not assets_dir.exists():
        raise RuntimeError(
            f"Expected frontend build artifacts at {assets_dir}. Run the build first."
        )

    files = [p for p in assets_dir.rglob("*") if p.is_file()]
    if not files:
        raise RuntimeError(f"No build artifacts found under {assets_dir}")

    js_files = [p for p in files if p.suffix == ".js"]
    css_files = [p for p in files if p.suffix == ".css"]

    largest_file = max(files, key=lambda p: p.stat().st_size)
    total_bytes = sum(p.stat().st_size for p in files)
    total_js_bytes = sum(p.stat().st_size for p in js_files)
    total_css_bytes = sum(p.stat().st_size for p in css_files)

    return {
        "asset_file_count": len(files),
        "total_asset_bytes": total_bytes,
        "total_js_bytes": total_js_bytes,
        "total_css_bytes": total_css_bytes,
        "largest_asset": {
            "path": str(largest_file.relative_to(frontend_dir)),
            "bytes": largest_file.stat().st_size,
        },
    }


def _setup_django(backend_dir: Path) -> None:
    os.environ.setdefault("RPS_ENV", "test")
    raw_allowed_hosts = os.getenv("ALLOWED_HOSTS", "")
    hosts = [host.strip() for host in raw_allowed_hosts.split(",") if host.strip()]
    if "testserver" not in hosts:
        hosts.append("testserver")
    os.environ["ALLOWED_HOSTS"] = ",".join(hosts)

    backend_path = str(backend_dir)
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    from rps.settings_bootstrap import configure_django_settings_module

    configure_django_settings_module()

    import django

    django.setup()


def _prepare_database() -> None:
    """Ensure the local baseline DB has the required tables."""
    from django.core.management import call_command

    call_command("migrate", interactive=False, run_syncdb=True, verbosity=0)


def _create_probe_fixture() -> ProbeFixture:
    from django.contrib.auth import get_user_model

    from apps.catalog.models import CatalogProject
    from apps.importer.models import ImportJob
    from apps.projects.models import Project, Story
    from apps.results.models import GlobalResultsCache, ResultSet

    suffix = uuid.uuid4().hex[:10]
    username = f"phase0-baseline-{suffix}"
    password = "Phase0BaselinePass!123"
    project_slug = f"phase0-baseline-{suffix}"

    user_model = get_user_model()
    user = user_model.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=password,
    )
    catalog_project = CatalogProject.objects.create(
        name=f"Phase 0 Baseline {suffix}",
        slug=project_slug,
        owner=user,
        analysis_type="NLTHA",
    )
    project = Project.objects.create(catalog_project=catalog_project)
    story = Story.objects.create(project=project, name="L1", sort_order=1)

    result_set_a = ResultSet.objects.create(project=project, name=f"RS-A-{suffix}")
    result_set_b = ResultSet.objects.create(project=project, name=f"RS-B-{suffix}")

    GlobalResultsCache.objects.create(
        project=project,
        result_set=result_set_a,
        result_type="Drifts_X",
        story=story,
        results_matrix={"TH01": 0.012},
        avg_value=0.012,
        max_value=0.012,
        min_value=0.012,
        load_case_count=1,
        story_sort_order=1,
    )
    GlobalResultsCache.objects.create(
        project=project,
        result_set=result_set_b,
        result_type="Drifts_X",
        story=story,
        results_matrix={"TH01": 0.018},
        avg_value=0.018,
        max_value=0.018,
        min_value=0.018,
        load_case_count=1,
        story_sort_order=1,
    )

    import_job = ImportJob.objects.create(
        project=project,
        user=user,
        status="pending",
        files=["/tmp/phase0-baseline.xlsx"],
        job_config={
            "prescan": {
                "file_load_cases": {
                    "phase0-baseline.xlsx": {"Story Drifts": ["TH01"]},
                },
                "foundation_joints": [],
                "files_scanned": 1,
                "errors": [],
            }
        },
    )

    return ProbeFixture(
        username=username,
        password=password,
        project_slug=project_slug,
        global_result_set_id=result_set_a.id,
        comparison_result_set_ids=(result_set_a.id, result_set_b.id),
        import_job_id=import_job.id,
    )


def _build_authenticated_client(fixture: ProbeFixture):
    from rest_framework.test import APIClient

    client = APIClient()
    login_response = client.post(
        "/api/auth/login/",
        {"username": fixture.username, "password": fixture.password},
        format="json",
    )
    if login_response.status_code != 200:
        raise RuntimeError(
            "Baseline probe login failed with status "
            f"{login_response.status_code}: {login_response.content!r}"
        )

    access_token = login_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    return client


def _timed_request(
    client, method: str, path: str, payload: dict | None = None
) -> tuple[float, object]:
    start = time.perf_counter()
    if method == "GET":
        response = client.get(path)
    elif method == "POST":
        response = client.post(path, payload or {}, format="json")
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
    elapsed_ms = (time.perf_counter() - start) * 1000

    if response.status_code >= 400:
        raise RuntimeError(
            f"Probe request failed: {method} {path} -> {response.status_code} {response.content!r}"
        )
    return elapsed_ms, response


def _measure_endpoint_latency(
    *,
    client,
    method: str,
    path: str,
    payload: dict | None,
    iterations: int,
) -> dict[str, float]:
    samples: list[float] = []
    for _ in range(iterations):
        elapsed_ms, _response = _timed_request(client, method, path, payload)
        samples.append(elapsed_ms)
    return _summarize_latency(samples)


def _collect_backend_metrics(iterations: int) -> dict[str, object]:
    fixture = _create_probe_fixture()
    client = _build_authenticated_client(fixture)

    global_path = (
        f"/api/projects/{fixture.project_slug}/results/global/"
        f"?result_set_id={fixture.global_result_set_id}&result_type=Drifts&direction=X"
    )
    comparison_path = (
        f"/api/projects/{fixture.project_slug}/results/comparison/"
        f"?result_set_ids={fixture.comparison_result_set_ids[0]},{fixture.comparison_result_set_ids[1]}"
        "&result_type=Drifts&direction=X&metric=Avg"
    )
    import_start_path = (
        f"/api/projects/{fixture.project_slug}/imports/{fixture.import_job_id}/start/"
    )
    export_start_path = f"/api/projects/{fixture.project_slug}/exports/"

    global_latency = _measure_endpoint_latency(
        client=client,
        method="GET",
        path=global_path,
        payload=None,
        iterations=iterations,
    )
    comparison_latency = _measure_endpoint_latency(
        client=client,
        method="GET",
        path=comparison_path,
        payload=None,
        iterations=iterations,
    )

    with patch(
        "apps.importer.views.process_import_task.delay",
        return_value=SimpleNamespace(id="phase0-baseline-import-task"),
    ):
        import_start_latency = _measure_endpoint_latency(
            client=client,
            method="POST",
            path=import_start_path,
            payload={
                "selected_load_cases": ["TH01"],
                "conflict_resolutions": [],
                "result_set_name": "Phase 0 Baseline Import",
            },
            iterations=iterations,
        )

    with patch(
        "apps.exporter.views.process_export_job.delay",
        return_value=SimpleNamespace(id="phase0-baseline-export-task"),
    ):
        export_start_latency = _measure_endpoint_latency(
            client=client,
            method="POST",
            path=export_start_path,
            payload={
                "result_set_id": fixture.global_result_set_id,
                "format": "excel",
                "result_types": ["Drifts"],
                "directions": ["X"],
                "include_summary": True,
            },
            iterations=iterations,
        )

    expansion_probe_paths = [
        f"/api/projects/{fixture.project_slug}/result-sets/",
        f"/api/projects/{fixture.project_slug}/available-types/",
        global_path,
        comparison_path,
    ]
    expansion_samples: list[float] = []
    for path in expansion_probe_paths:
        elapsed_ms, _response = _timed_request(client, "GET", path)
        expansion_samples.append(elapsed_ms)

    return {
        "latency_ms": {
            "global_results_read": global_latency,
            "comparison_read": comparison_latency,
            "import_start": import_start_latency,
            "export_start": export_start_latency,
        },
        "tree_expansion_probe": {
            "request_count": len(expansion_probe_paths),
            "total_latency_ms": round(sum(expansion_samples), 2),
            "avg_request_latency_ms": round(statistics.fmean(expansion_samples), 2),
            "paths": expansion_probe_paths,
        },
    }


def _render_markdown_report(metrics: dict[str, object], generated_at: str) -> str:
    bundle = metrics["bundle"]
    backend = metrics["backend"]
    latency = backend["latency_ms"]
    tree_probe = backend["tree_expansion_probe"]

    return "\n".join(
        [
            "# Phase 0 Baseline Report",
            "",
            f"- Generated at: {generated_at}",
            "- Method: `scripts/capture_phase0_baseline.py`",
            "",
            "## Frontend Bundle",
            f"- Asset files: {bundle['asset_file_count']}",
            f"- Total assets (bytes): {bundle['total_asset_bytes']}",
            f"- Total JS (bytes): {bundle['total_js_bytes']}",
            f"- Total CSS (bytes): {bundle['total_css_bytes']}",
            (
                "- Largest asset: "
                f"{bundle['largest_asset']['path']} ({bundle['largest_asset']['bytes']} bytes)"
            ),
            "",
            "## Backend API Latency (ms)",
            (
                "- Global results read: "
                f"avg={latency['global_results_read']['avg_ms']}, "
                f"p95={latency['global_results_read']['p95_ms']}"
            ),
            (
                "- Comparison read: "
                f"avg={latency['comparison_read']['avg_ms']}, "
                f"p95={latency['comparison_read']['p95_ms']}"
            ),
            (
                "- Import start (kickoff): "
                f"avg={latency['import_start']['avg_ms']}, "
                f"p95={latency['import_start']['p95_ms']}"
            ),
            (
                "- Export start (kickoff): "
                f"avg={latency['export_start']['avg_ms']}, "
                f"p95={latency['export_start']['p95_ms']}"
            ),
            "",
            "## Tree Expansion Probe",
            ("- Request count: " f"{tree_probe['request_count']}"),
            ("- Total latency (ms): " f"{tree_probe['total_latency_ms']}"),
            ("- Avg request latency (ms): " f"{tree_probe['avg_request_latency_ms']}"),
            "",
            "## Notes",
            "- Import/Export metrics are start-endpoint kickoff latency baselines for Phase 0.",
            "- Full background-job runtime baselines will be captured after stable fixture datasets are added.",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/refactor/phase-0-baseline-report.md"),
        help="Path to write the markdown baseline report.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path("docs/refactor/phase-0-baseline-report.json"),
        help="Path to write the raw JSON baseline payload.",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=12,
        help="Number of timed samples per endpoint.",
    )
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Skip `npm run build` and read existing dist assets only.",
    )
    args = parser.parse_args()

    if args.iterations < 3:
        raise RuntimeError("--iterations must be at least 3 for p95 sampling")

    root_dir = Path(__file__).resolve().parents[1]
    frontend_dir = root_dir / "frontend"
    backend_dir = root_dir / "backend"

    _require_environment()

    if not args.skip_frontend_build:
        _run_frontend_build(frontend_dir)

    bundle_metrics = _collect_bundle_metrics(frontend_dir)

    _setup_django(backend_dir)
    _prepare_database()
    backend_metrics = _collect_backend_metrics(iterations=args.iterations)

    generated_at = datetime.now(timezone.utc).isoformat()
    metrics = {
        "generated_at": generated_at,
        "bundle": bundle_metrics,
        "backend": backend_metrics,
    }

    output_path = args.output if args.output.is_absolute() else root_dir / args.output
    json_output_path = (
        args.json_output
        if args.json_output.is_absolute()
        else root_dir / args.json_output
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        _render_markdown_report(metrics, generated_at), encoding="utf-8"
    )

    json_output_path.parent.mkdir(parents=True, exist_ok=True)
    json_output_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
