"""Provider functions for joint/foundation result data."""

from typing import Any, Dict, List, Optional

from apps.results.models import JointResultsCache

from ..datasets import ResultDataset, ResultDatasetMeta


def _build_summary_columns(
    rows: List[Dict[str, Any]],
    load_case_columns: List[str],
    is_pushover: bool,
) -> List[str]:
    """Populate fallback summary columns when aggregates are not precomputed."""
    if is_pushover or not load_case_columns:
        return []

    for row in rows:
        if 'Avg' in row:
            continue
        values = [row.get(lc, 0) for lc in load_case_columns if lc in row]
        if not values:
            continue
        row['Avg'] = sum(values) / len(values)
        row['Max'] = max(values)
        row['Min'] = min(values)

    return ['Avg', 'Max', 'Min']


def get_joint_results(
    service,
    result_set_id: int,
    result_type: str,
    is_pushover: bool = False,
) -> Optional[ResultDataset]:
    """Get joint/foundation results from cache."""
    cache_entries = JointResultsCache.objects.filter(
        project=service.project,
        result_set_id=result_set_id,
        result_type=result_type,
    ).order_by('unique_name')

    if not cache_entries.exists():
        return None

    rows = []
    load_case_set = set()
    base_type = result_type.replace('_Min', '').replace('_Max', '')

    for entry in cache_entries:
        row = {
            'Element': entry.shell_object,
            'UniqueID': entry.unique_name,
        }
        for lc_name, value in entry.results_matrix.items():
            row[lc_name] = service._apply_multiplier(value, base_type)
            load_case_set.add(lc_name)

        if entry.avg_value is not None:
            row['Avg'] = service._apply_multiplier(entry.avg_value, base_type)
        if entry.max_value is not None:
            row['Max'] = service._apply_multiplier(entry.max_value, base_type)
        if entry.min_value is not None:
            row['Min'] = service._apply_multiplier(entry.min_value, base_type)

        rows.append(row)

    if not rows:
        return None

    load_case_columns = sorted(load_case_set)
    summary_columns = _build_summary_columns(rows, load_case_columns, is_pushover)

    return ResultDataset(
        meta=ResultDatasetMeta(
            result_type=base_type,
            direction=None,
            result_set_id=result_set_id,
            display_name=service._get_display_name(base_type, None),
        ),
        rows=rows,
        load_case_columns=load_case_columns,
        summary_columns=summary_columns,
        story_column='Element',
    )
