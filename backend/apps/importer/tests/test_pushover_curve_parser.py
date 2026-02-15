from pathlib import Path

import pandas as pd

from apps.importer.parsers.excel_parser import ExcelParser


class _FakeExcelFile:
    def __init__(self, sheets: dict[str, pd.DataFrame]):
        self._sheets = sheets

    def parse(self, sheet_name: str, **_kwargs) -> pd.DataFrame:
        return self._sheets[sheet_name].copy()


def _build_parser(displ_df: pd.DataFrame, force_df: pd.DataFrame) -> ExcelParser:
    parser = ExcelParser.__new__(ExcelParser)
    parser.file_path = Path("dummy.xlsx")
    parser._excel_file = None
    parser._joint_displacements_df = None
    parser._available_sheets = None
    parser._column_forces_df = None
    parser._sheet_headers_cache = {}
    parser._load_cases_cache = {}

    fake_excel = _FakeExcelFile(
        {
            "Joint Displacements": displ_df,
            "Story Forces": force_df,
        }
    )

    parser._get_excel_file = lambda: fake_excel
    parser.validate_sheet_exists = lambda sheet_name: sheet_name in {
        "Joint Displacements",
        "Story Forces",
    }
    return parser


def test_curve_displacements_follow_desktop_normalization_from_first_point():
    displ_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Step Number": [0, 1, 2],
            "Ux": [5.0, -5.0, 15.0],
            "Uy": [0.0, 0.0, 0.0],
        }
    )
    force_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Story": ["Base", "Base", "Base"],
            "Location": ["Bottom", "Bottom", "Bottom"],
            "Step Number": [0, 1, 2],
            "VX": [0.0, 100.0, 200.0],
            "VY": [0.0, 0.0, 0.0],
        }
    )

    parser = _build_parser(displ_df, force_df)
    curve_df, cases = parser.get_pushover_curve_data(base_story="Base")

    assert cases == ["Push_X+"]
    assert not curve_df.empty

    case_df = curve_df[curve_df["Case"] == "Push_X+"].sort_values("Step").reset_index(drop=True)
    assert case_df["Step"].tolist() == [0, 1, 2]
    # Normalize by subtracting step-0 displacement: Ux - Ux(step=0), step 0 included.
    assert case_df["Displacement"].tolist() == [0.0, -10.0, 10.0]
    assert case_df["BaseShear"].tolist() == [0.0, 100.0, 200.0]


def test_curve_merge_uses_index_aligned_step_matching():
    displ_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Step Number": [0, 1, 2],
            "Ux": [5.0, 10.0, 20.0],
            "Uy": [0.0, 0.0, 0.0],
        }
    )
    force_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Story": ["Base", "Base", "Base"],
            "Location": ["Bottom", "Bottom", "Bottom"],
            "Step Number": [1, 2, 3],
            "VX": [100.0, 200.0, 300.0],
            "VY": [0.0, 0.0, 0.0],
        }
    )

    parser = _build_parser(displ_df, force_df)
    curve_df, _cases = parser.get_pushover_curve_data(base_story="Base")

    # Desktop parser keeps only index-aligned rows with equal step numbers.
    assert curve_df.empty


def test_curve_normalization_uses_step_zero_even_if_not_first_row():
    displ_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Step Number": [1, 0, 2],
            "Ux": [-5.0, 5.0, 15.0],
            "Uy": [0.0, 0.0, 0.0],
        }
    )
    force_df = pd.DataFrame(
        {
            "Output Case": ["Push_X+", "Push_X+", "Push_X+"],
            "Story": ["Base", "Base", "Base"],
            "Location": ["Bottom", "Bottom", "Bottom"],
            "Step Number": [1, 0, 2],
            "VX": [100.0, 0.0, 200.0],
            "VY": [0.0, 0.0, 0.0],
        }
    )

    parser = _build_parser(displ_df, force_df)
    curve_df, cases = parser.get_pushover_curve_data(base_story="Base")

    assert cases == ["Push_X+"]
    case_df = curve_df[curve_df["Case"] == "Push_X+"].sort_values("Step").reset_index(drop=True)
    assert case_df["Step"].tolist() == [0, 1, 2]
    assert case_df["Displacement"].tolist() == [0.0, -10.0, 10.0]
