"""Provider functions for comparison datasets."""

from typing import List, Optional

from config.result_types import RESULT_TYPE_CONFIG

from apps.results.data import ResultSetRepository

from ..datasets import ComparisonDataset, ComparisonSeries

JOINT_RESULT_TYPES = {
    "SoilPressures",
    "SoilPressures_Min",
    "SoilPressures_Max",
    "VerticalDisplacements",
    "VerticalDisplacements_Min",
    "VerticalDisplacements_Max",
}


def _fetch_dataset(service, rs_id, result_type, direction, element_id):
    """Route to the correct provider based on result type."""
    if element_id:
        return service.get_element_results(
            result_set_id=rs_id,
            element_id=element_id,
            result_type=result_type,
            direction=direction,
        )
    if result_type in JOINT_RESULT_TYPES:
        return service.get_joint_results(
            result_set_id=rs_id,
            result_type=result_type,
        )
    return service.get_global_results(
        result_set_id=rs_id,
        result_type=result_type,
        direction=direction,
    )


def get_comparison_dataset(
    service,
    result_type: str,
    direction: Optional[str],
    result_set_ids: List[int],
    metric: str = "Avg",
    element_id: Optional[int] = None,
) -> Optional[ComparisonDataset]:
    """Get comparison data across multiple result sets."""
    if len(result_set_ids) < 2:
        return None

    series_list = []
    all_stories = set()
    story_order = {}
    warnings = []

    result_sets = ResultSetRepository.get_project_result_set_name_map(
        service.project,
        result_set_ids,
    )

    for rs_id in result_set_ids:
        rs_name = result_sets.get(rs_id, f"ResultSet {rs_id}")

        dataset = _fetch_dataset(service, rs_id, result_type, direction, element_id)

        if not dataset or metric not in dataset.summary_columns:
            series_list.append(
                ComparisonSeries(
                    result_set_id=rs_id,
                    result_set_name=rs_name,
                    values={},
                    has_data=False,
                    warning=f"No {metric} data for {rs_name}",
                )
            )
            warnings.append(f"Missing data for {rs_name}")
            continue

        row_key = dataset.story_column or "Story"
        values = {}
        for row in dataset.rows:
            story = row.get(row_key)
            if story and metric in row:
                values[story] = row[metric]
                all_stories.add(story)
                row_sort_order = row.get("story_sort_order")
                if isinstance(row_sort_order, (int, float)):
                    story_order[story] = int(row_sort_order)

        series_list.append(
            ComparisonSeries(
                result_set_id=rs_id,
                result_set_name=rs_name,
                values=values,
                has_data=bool(values),
            )
        )

    if not any(s.has_data for s in series_list):
        return None

    rows = []
    for story in sorted(
        all_stories,
        key=lambda name: (-story_order.get(name, -1), name),
    ):
        row = {"Story": story}
        for series in series_list:
            col_name = f"{series.result_set_name}_{metric}"
            row[col_name] = series.values.get(story)
        rows.append(row)

    ratio_column = None
    if len(series_list) >= 2 and series_list[0].has_data and series_list[-1].has_data:
        first_name = f"{series_list[0].result_set_name}_{metric}"
        last_name = f"{series_list[-1].result_set_name}_{metric}"
        ratio_column = f"{series_list[-1].result_set_name}/{series_list[0].result_set_name}"

        for row in rows:
            first_val = row.get(first_name)
            last_val = row.get(last_name)
            if first_val is None or last_val is None:
                continue
            if first_val == 0:
                row[ratio_column] = None
                continue
            row[ratio_column] = last_val / first_val

    config = RESULT_TYPE_CONFIG.get(result_type, {})
    unit = config.get("unit", "")
    decimals = config.get("decimals")
    if not isinstance(decimals, int):
        decimals = None

    return ComparisonDataset(
        result_type=result_type,
        direction=direction,
        metric=metric,
        series=series_list,
        rows=rows,
        ratio_column=ratio_column,
        unit=unit,
        decimals=decimals,
        warnings=warnings,
    )
