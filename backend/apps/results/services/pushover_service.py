"""Helpers for assembling pushover curve payloads."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List

from django.db.models import Prefetch, QuerySet

from ..models import PushoverCase, PushoverCurvePoint


def _build_curve_data(case: PushoverCase, points: Iterable[PushoverCurvePoint]) -> Dict[str, Any]:
    ordered_points = list(points)

    reference_displacement = 0.0
    if ordered_points:
        step_zero_point = next((point for point in ordered_points if point.step_number == 0), ordered_points[0])
        reference_displacement = float(step_zero_point.displacement)

    return {
        "case": {
            "id": case.id,
            "name": case.name,
            "direction": case.direction,
        },
        "points": [
            {
                "step": point.step_number,
                "displacement": float(point.displacement) - reference_displacement,
                "base_shear": point.base_shear,
            }
            for point in ordered_points
        ],
    }


def get_curve_data_for_case(case: PushoverCase) -> Dict[str, Any]:
    points = list(PushoverCurvePoint.objects.filter(pushover_case=case).order_by("step_number"))
    return _build_curve_data(case, points)


def get_curves_batch_data(
    *,
    project: Any,
    result_set_id: int,
    direction: str,
) -> List[Dict[str, Any]]:
    case_queryset: QuerySet[PushoverCase] = (
        PushoverCase.objects.filter(
            project=project,
            result_set_id=result_set_id,
            direction=direction,
        )
        .prefetch_related(
            Prefetch(
                "curve_points",
                queryset=PushoverCurvePoint.objects.order_by("step_number"),
            )
        )
        .order_by("name")
    )

    return [
        _build_curve_data(case, case.curve_points.all())
        for case in case_queryset
    ]
