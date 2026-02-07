"""Provider functions for comparison datasets."""

from typing import List, Optional

from apps.results.models import ResultSet

from ..datasets import ComparisonDataset, ComparisonSeries


def get_comparison_dataset(
    service,
    result_type: str,
    direction: Optional[str],
    result_set_ids: List[int],
    metric: str = 'Avg',
    element_id: Optional[int] = None,
) -> Optional[ComparisonDataset]:
    """Get comparison data across multiple result sets."""
    if len(result_set_ids) < 2:
        return None

    series_list = []
    all_stories = set()
    warnings = []

    result_sets = {
        rs.id: rs.name
        for rs in ResultSet.objects.filter(id__in=result_set_ids)
    }

    for rs_id in result_set_ids:
        rs_name = result_sets.get(rs_id, f'ResultSet {rs_id}')

        if element_id:
            dataset = service.get_element_results(
                result_set_id=rs_id,
                element_id=element_id,
                result_type=result_type,
                direction=direction,
            )
        else:
            dataset = service.get_global_results(
                result_set_id=rs_id,
                result_type=result_type,
                direction=direction,
            )

        if not dataset or metric not in dataset.summary_columns:
            series_list.append(ComparisonSeries(
                result_set_id=rs_id,
                result_set_name=rs_name,
                values={},
                has_data=False,
                warning=f'No {metric} data for {rs_name}',
            ))
            warnings.append(f'Missing data for {rs_name}')
            continue

        values = {}
        for row in dataset.rows:
            story = row.get('Story')
            if story and metric in row:
                values[story] = row[metric]
                all_stories.add(story)

        series_list.append(ComparisonSeries(
            result_set_id=rs_id,
            result_set_name=rs_name,
            values=values,
            has_data=bool(values),
        ))

    if not any(s.has_data for s in series_list):
        return None

    rows = []
    for story in sorted(all_stories):
        row = {'Story': story}
        for series in series_list:
            col_name = f'{series.result_set_name}_{metric}'
            row[col_name] = series.values.get(story)
        rows.append(row)

    ratio_column = None
    if len(series_list) >= 2 and series_list[0].has_data and series_list[-1].has_data:
        first_name = f'{series_list[0].result_set_name}_{metric}'
        last_name = f'{series_list[-1].result_set_name}_{metric}'
        ratio_column = f'{series_list[-1].result_set_name}/{series_list[0].result_set_name}'

        for row in rows:
            first_val = row.get(first_name)
            last_val = row.get(last_name)
            if first_val and last_val and first_val != 0:
                row[ratio_column] = last_val / first_val

    return ComparisonDataset(
        result_type=result_type,
        direction=direction,
        metric=metric,
        series=series_list,
        rows=rows,
        ratio_column=ratio_column,
        warnings=warnings,
    )
