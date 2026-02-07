"""Excel file parser for ETABS/SAP2000 results.

Ported from RPS_desktop/src/processing/excel_parser.py
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class TimeSeriesData:
    """Container for a single time series (one story, one direction)."""

    story: str
    direction: str
    time_steps: List[float]
    values: List[float]
    story_sort_order: int = 0


@dataclass
class TimeHistoryParseResult:
    """Container for all parsed time history data from a file."""

    load_case_name: str
    drifts_x: List[TimeSeriesData] = field(default_factory=list)
    drifts_y: List[TimeSeriesData] = field(default_factory=list)
    forces_x: List[TimeSeriesData] = field(default_factory=list)
    forces_y: List[TimeSeriesData] = field(default_factory=list)
    displacements_x: List[TimeSeriesData] = field(default_factory=list)
    displacements_y: List[TimeSeriesData] = field(default_factory=list)
    accelerations_x: List[TimeSeriesData] = field(default_factory=list)
    accelerations_y: List[TimeSeriesData] = field(default_factory=list)
    stories: List[str] = field(default_factory=list)


class ExcelParser:
    """Parser for ETABS/SAP2000 Excel result files."""

    def __init__(self, file_path: str):
        """Initialize parser with Excel file path.

        Args:
            file_path: Path to Excel file
        """
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"Excel file not found: {file_path}")
        self._excel_file: Optional[pd.ExcelFile] = None
        self._joint_displacements_df: Optional[pd.DataFrame] = None
        self._available_sheets: Optional[List[str]] = None
        self._column_forces_df: Optional[pd.DataFrame] = None
        self._sheet_headers_cache: Dict[str, List[Any]] = {}  # Cache for sheet headers

    def _get_excel_file(self) -> pd.ExcelFile:
        if self._excel_file is None:
            self._excel_file = pd.ExcelFile(self.file_path)
        return self._excel_file

    def close(self) -> None:
        excel_file = getattr(self, "_excel_file", None)
        if excel_file is not None:
            try:
                excel_file.close()
            except (AttributeError, OSError, ValueError) as exc:
                logger.warning(
                    "Failed to close Excel file '%s': %s",
                    self.file_path,
                    exc,
                )
            self._excel_file = None

    def __del__(self) -> None:
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    @staticmethod
    def _normalize_header_name(name: object) -> str:
        return "".join(ch for ch in str(name).lower() if ch.isalnum())

    def _find_output_case_column(self, columns: List[object]) -> Optional[object]:
        target = "outputcase"
        for col in columns:
            if self._normalize_header_name(col) == target:
                return col
        return None

    def read_sheet(
        self,
        sheet_name: str,
        columns: List[int],
        skiprows: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        """Read a specific sheet from the Excel file.

        Args:
            sheet_name: Name of the sheet to read
            columns: List of column indices to read
            skiprows: List of row indices to skip (default: [0, 2] for ETABS format)

        Returns:
            DataFrame containing the sheet data
        """
        if skiprows is None:
            skiprows = [0, 2]  # Standard ETABS format

        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet_name,
                skiprows=skiprows,
                usecols=columns,
            )
            return df
        except Exception as e:
            raise ValueError(f"Error reading sheet '{sheet_name}': {e}")

    def get_unique_values(self, df: pd.DataFrame, column_names: List[str]) -> Dict[str, List[Any]]:
        """Get unique values for specified columns.

        Args:
            df: DataFrame to process
            column_names: List of column names to extract unique values from

        Returns:
            Dictionary mapping column names to lists of unique values
        """
        result = {}
        for col_name in column_names:
            if col_name in df.columns:
                unique_vals = df[col_name].unique().tolist()
                result[col_name] = unique_vals
            else:
                raise ValueError(f"Column '{col_name}' not found in DataFrame")
        return result

    def get_story_drifts(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse story drift data from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories)

        Note:
            Stories list preserves exact order from Excel (typically bottom to top from ETABS).
            sort_order = index in this list (0=first story in Excel, typically ground floor).
            For plotting: higher sort_order = higher in building.
            Step Type column indicates Max or Min envelope values.
        """
        sheet = "Story Drifts"
        columns = [0, 1, 2, 3, 4, 5]  # Output Case, Story, Step Type, Direction, Drift columns

        df = self.read_sheet(sheet, columns)

        # Get unique load cases and stories
        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]

        return df, load_cases, stories

    def get_story_accelerations(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse story acceleration data from 'Diaphragm Accelerations' sheet.

        Returns:
            Tuple of (DataFrame, load_cases, stories)

        Note:
            Stories list preserves exact order from Excel (typically bottom to top from ETABS).
            Format has separate Max/Min rows with Max UX/UY and Min UX/UY columns.
        """
        sheet = "Diaphragm Accelerations"
        columns = [
            0,
            2,
            4,
            5,
            6,
            11,
            12,
        ]  # Story, Output Case, Step Type, Max UX, Max UY, Min UX, Min UY

        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]

        return df, load_cases, stories

    def get_story_forces(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse story force data from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories)
        """
        sheet = "Story Forces"
        # Columns: Story, Output Case, Step Type, Location, VX, VY
        columns = [0, 1, 3, 4, 6, 7]

        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]

        return df, load_cases, stories

    def get_pier_forces(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        """Parse pier force data from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories, piers)
        """
        sheet = "Pier Forces"
        columns = [0, 1, 2, 4, 5, 7, 8]  # Story, Pier, Output Case, Location, P, V2, V3

        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Pier"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        piers = unique_vals["Pier"]

        return df, load_cases, stories, piers

    def get_joint_displacements(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse joint displacement data (global) from Excel file.

        Returns:
            Tuple of (DataFrame with Story, Output Case, Step Type, Ux, Uy columns;
                       load_cases; stories)
        """
        sheet = "Joint Displacements"

        if not self.validate_sheet_exists(sheet):
            return pd.DataFrame(), [], []

        df_full = self._load_joint_displacements_full()
        df = df_full[["Story", "Output Case", "Step Type", "Ux", "Uy"]].dropna(
            subset=["Story", "Output Case"]
        )

        load_cases = df["Output Case"].unique().tolist()
        stories = df["Story"].unique().tolist()

        return df, load_cases, stories

    def get_available_sheets(self) -> List[str]:
        """Get list of available sheets in the Excel file.

        Returns:
            List of sheet names
        """
        try:
            if self._available_sheets is None:
                self._available_sheets = list(self._get_excel_file().sheet_names)
            return list(self._available_sheets)
        except Exception as e:
            raise ValueError(f"Error reading Excel file: {e}")

    def validate_sheet_exists(self, sheet_name: str) -> bool:
        """Check if a sheet exists in the Excel file.

        Args:
            sheet_name: Name of sheet to check

        Returns:
            True if sheet exists, False otherwise
        """
        available_sheets = self.get_available_sheets()
        return sheet_name in available_sheets

    def _load_joint_displacements_full(self) -> pd.DataFrame:
        """Load the Joint Displacements sheet (all needed columns) with simple caching."""
        if self._joint_displacements_df is None:
            sheet = "Joint Displacements"
            columns = [0, 1, 2, 3, 5, 6, 7, 8]
            df = self.read_sheet(sheet, columns, skiprows=[0, 2])
            df.columns = [
                "Story",
                "Label",
                "Unique Name",
                "Output Case",
                "Step Type",
                "Ux",
                "Uy",
                "Uz",
            ]
            self._joint_displacements_df = df
        return self._joint_displacements_df.copy()

    def _get_sheet_headers(self, sheet_name: str) -> Optional[List[Any]]:
        """Get cached headers for a sheet."""
        if sheet_name not in self._sheet_headers_cache:
            try:
                header_df = self._get_excel_file().parse(
                    sheet_name=sheet_name,
                    skiprows=[0, 2],
                    nrows=0,
                )
                self._sheet_headers_cache[sheet_name] = list(header_df.columns)
            except (KeyError, TypeError, ValueError):
                return None
        return self._sheet_headers_cache[sheet_name]

    def get_load_cases_only(self, sheet_name: str) -> Optional[List[str]]:
        """Return load cases from a sheet using a lightweight read.

        Optimized with header caching to avoid repeated header parsing.
        """
        if not self.validate_sheet_exists(sheet_name):
            return []

        columns = self._get_sheet_headers(sheet_name)
        if columns is None:
            return None

        # Find Output Case column index
        output_case_idx = None
        for idx, col in enumerate(columns):
            if self._normalize_header_name(col) == "outputcase":
                output_case_idx = idx
                break

        if output_case_idx is None:
            return None

        try:
            # Read only the Output Case column by index
            df = self._get_excel_file().parse(
                sheet_name=sheet_name,
                skiprows=[0, 2],
                usecols=[output_case_idx],
            )
        except (KeyError, TypeError, ValueError):
            return None

        if df.empty:
            return []
        series = df.iloc[:, 0].dropna()
        if series.empty:
            return []
        return pd.unique(series.astype(str)).tolist()

    def get_column_forces(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        """Parse column force data from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories, columns)
        """
        sheet = "Element Forces - Columns"
        columns = [
            0,
            1,
            2,
            3,
            6,
            7,
            8,
            9,
        ]  # Story, Column, Unique Name, Output Case, Location, P, V2, V3

        if self._column_forces_df is None:
            self._column_forces_df = self.read_sheet(sheet, columns)
        df = self._column_forces_df.copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Column"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        columns_list = unique_vals["Column"]

        return df, load_cases, stories, columns_list

    def get_quad_rotations(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        """Parse quad strain gauge rotation data from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories, piers)
        """
        sheet = "Quad Strain Gauge - Rotation"
        columns = [
            0,
            1,
            2,
            3,
            5,
            6,
            7,
            8,
            9,
        ]  # Story, Name, PropertyName, Output Case, StepType, Direction, Rotation, MaxRotation, MinRotation

        df = self.read_sheet(sheet, columns)

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "PropertyName"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        piers = unique_vals["PropertyName"]

        return df, load_cases, stories, piers

    def get_fiber_hinge_states(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        """Parse fiber hinge state data for columns from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories, columns)

        Note:
            Only processes columns where Frame/Wall starts with 'C' (e.g., C2, C10).
        """
        sheet = "Fiber Hinge States"
        columns = [
            0,
            1,
            2,
            3,
            5,
            20,
            21,
        ]  # Story, Frame/Wall, Unique Name, Output Case, Step Type, R2, R3

        df = self.read_sheet(sheet, columns)

        # Filter only columns (Frame/Wall starts with 'C')
        if "Frame/Wall" in df.columns:
            df = df[df["Frame/Wall"].astype(str).str.startswith("C", na=False)].copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Frame/Wall"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        columns_list = unique_vals["Frame/Wall"]

        return df, load_cases, stories, columns_list

    def get_hinge_states(self) -> Tuple[pd.DataFrame, List[str], List[str], List[str]]:
        """Parse hinge state data for beams from Excel file.

        Returns:
            Tuple of (DataFrame, load_cases, stories, beams)

        Note:
            Only processes beams where Frame/Wall starts with 'B' (e.g., B19, B20).
        """
        sheet = "Hinge States"
        columns = [
            0,
            1,
            2,
            3,
            5,
            6,
            7,
            8,
            21,
        ]  # Story, Frame/Wall, Unique Name, Output Case, Step Type, Hinge, Generated Hinge, Rel Dist, R3 Plastic

        df = self.read_sheet(sheet, columns)

        # Filter only beams (Frame/Wall starts with 'B')
        if "Frame/Wall" in df.columns:
            df = df[df["Frame/Wall"].astype(str).str.startswith("B", na=False)].copy()

        unique_vals = self.get_unique_values(df, ["Output Case", "Story", "Frame/Wall"])
        load_cases = unique_vals["Output Case"]
        stories = unique_vals["Story"]
        beams_list = unique_vals["Frame/Wall"]

        return df, load_cases, stories, beams_list

    def get_soil_pressures(self) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse soil pressure data from 'Soil Pressures' sheet.

        Returns:
            Tuple of (DataFrame, load_cases, unique_elements)

        Note:
            Computes minimum soil pressure per (Unique Name, Output Case).
        """
        sheet = "Soil Pressures"
        columns = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

        df = self.read_sheet(sheet, columns)

        df.columns = [
            "Story",
            "Shell Object",
            "Unique Name",
            "Shell Element",
            "Joint",
            "Output Case",
            "Case Type",
            "Step Type",
            "Soil Pressure",
            "Global X",
            "Global Y",
            "Global Z",
        ]

        df["Soil Pressure"] = pd.to_numeric(df["Soil Pressure"], errors="coerce")

        # Filter to only Min step type
        df = df[df["Step Type"] == "Min"].copy()

        # Min soil pressure per (Shell Object, Unique Name, Output Case)
        grp = df.groupby(["Shell Object", "Unique Name", "Output Case"], as_index=False)[
            "Soil Pressure"
        ].min()

        load_cases = grp["Output Case"].unique().tolist()
        unique_elements = grp["Unique Name"].unique().tolist()

        return grp, load_cases, unique_elements

    def get_foundation_joints(self) -> List[str]:
        """Parse foundation joint list from 'Fou' sheet.

        Returns:
            List of unique joint names to monitor for vertical displacements
        """
        sheet = "Fou"

        if not self.validate_sheet_exists(sheet):
            return []

        df = self.read_sheet(sheet, columns=[0])

        if "Unique Name" in df.columns:
            joint_names = df["Unique Name"].dropna().astype(str).unique().tolist()
        else:
            joint_names = df.iloc[:, 0].dropna().astype(str).unique().tolist()

        return joint_names

    def get_vertical_displacements(
        self, foundation_joints: Optional[List[str]] = None
    ) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """Parse vertical displacement data from 'Joint Displacements' sheet.

        Args:
            foundation_joints: Optional list of joint names to filter. If None, reads from Fou sheet.

        Returns:
            Tuple of (DataFrame, load_cases, unique_joints)
        """
        if foundation_joints is None:
            foundation_joints = self.get_foundation_joints()

        if not foundation_joints:
            return pd.DataFrame(), [], []

        df = self._load_joint_displacements_full()

        df["Unique Name"] = df["Unique Name"].astype(str)
        df = df[df["Unique Name"].isin(foundation_joints)].copy()

        if df.empty:
            return pd.DataFrame(), [], []

        df["Uz"] = pd.to_numeric(df["Uz"], errors="coerce")

        # Filter to only Min step type
        df = df[df["Step Type"] == "Min"].copy()

        # Min Uz per (Unique Name, Output Case)
        grp = df.groupby(["Unique Name", "Output Case"], as_index=False).agg(
            {
                "Uz": "min",
                "Story": "first",
                "Label": "first",
            }
        )

        grp = grp.rename(columns={"Uz": "Min Uz"})

        load_cases = grp["Output Case"].unique().tolist()
        unique_joints = grp["Unique Name"].unique().tolist()

        return grp, load_cases, unique_joints

    # --- Pushover Methods ---

    @staticmethod
    def detect_pushover_direction(case_name: str) -> str:
        """Detect direction from pushover case name.

        Args:
            case_name: Pushover case name (e.g., 'Push_X+', 'Push_Y-', 'Push_XY+')

        Returns:
            'X', 'Y', 'XY', or 'Unknown'
        """
        case_upper = str(case_name).upper()
        has_x = "X" in case_upper
        has_y = "Y" in case_upper

        if has_x and has_y:
            return "XY"
        if has_x:
            return "X"
        if has_y:
            return "Y"
        return "Unknown"

    def get_pushover_cases(self) -> List[str]:
        """Get list of pushover case names from Story Forces sheet.

        Pushover cases are identified by having Step Number instead of Step Type.

        Returns:
            List of pushover case names
        """
        sheet = "Story Forces"
        if not self.validate_sheet_exists(sheet):
            return []

        try:
            # Read header to check columns
            header_df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                nrows=5,  # Just a few rows to check
            )

            # If 'Step Number' column exists, it's pushover data
            if "Step Number" not in header_df.columns:
                return []

            # Get all unique output cases
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                usecols=["Output Case"],
            )

            cases = df["Output Case"].dropna().unique().tolist()
            # Filter to only pushover-like case names (contain 'Push' or similar)
            pushover_cases = [c for c in cases if "push" in str(c).lower()]
            return pushover_cases

        except Exception as e:
            logger.warning(f"Error getting pushover cases: {e}")
            return []

    def get_pushover_curve_data(
        self, base_story: Optional[str] = None
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Parse pushover curve data (displacement vs base shear).

        Reads from Joint Displacements (roof displacement) and Story Forces (base shear).

        Args:
            base_story: Story name for base shear extraction. If None, uses first story.

        Returns:
            Tuple of (DataFrame with columns [Case, Step, Displacement, BaseShear, Direction], case_names)
        """
        import math

        displ_sheet = "Joint Displacements"
        force_sheet = "Story Forces"

        if not self.validate_sheet_exists(displ_sheet) or not self.validate_sheet_exists(
            force_sheet
        ):
            return pd.DataFrame(), []

        try:
            # Read displacement data
            displ_df = self._get_excel_file().parse(
                sheet_name=displ_sheet,
                skiprows=[0, 2],
            )

            # Read force data
            force_df = self._get_excel_file().parse(
                sheet_name=force_sheet,
                skiprows=[0, 2],
            )

            # Check if this is pushover data (has Step Number)
            if "Step Number" not in displ_df.columns or "Step Number" not in force_df.columns:
                return pd.DataFrame(), []

            # Get pushover cases
            pushover_cases = [
                c for c in displ_df["Output Case"].dropna().unique() if "push" in str(c).lower()
            ]

            if not pushover_cases:
                return pd.DataFrame(), []

            # Find base story if not specified
            if base_story is None:
                stories = force_df["Story"].dropna().unique().tolist()
                if stories:
                    base_story = stories[0]  # Use first story as base
                else:
                    return pd.DataFrame(), []

            results = []

            for case_name in pushover_cases:
                direction = self.detect_pushover_direction(case_name)

                # Get roof displacements for this case
                case_displ = displ_df[displ_df["Output Case"] == case_name].copy()

                # Get base shear for this case (bottom location of base story)
                case_force = force_df[
                    (force_df["Output Case"] == case_name)
                    & (force_df["Story"] == base_story)
                    & (force_df["Location"] == "Bottom")
                ].copy()

                if case_displ.empty or case_force.empty:
                    continue

                # Group by step number to get max displacement per step
                step_groups = case_displ.groupby("Step Number")

                for step_num, step_df in step_groups:
                    # Get displacement based on direction
                    ux = step_df["Ux"].abs().max() if "Ux" in step_df.columns else 0
                    uy = step_df["Uy"].abs().max() if "Uy" in step_df.columns else 0

                    if direction == "X":
                        displacement = ux
                    elif direction == "Y":
                        displacement = uy
                    elif direction == "XY":
                        displacement = math.sqrt(ux**2 + uy**2)
                    else:
                        displacement = max(ux, uy)

                    # Get base shear for this step
                    step_force = case_force[case_force["Step Number"] == step_num]
                    if step_force.empty:
                        continue

                    vx = step_force["VX"].abs().max() if "VX" in step_force.columns else 0
                    vy = step_force["VY"].abs().max() if "VY" in step_force.columns else 0

                    if direction == "X":
                        base_shear = vx
                    elif direction == "Y":
                        base_shear = vy
                    elif direction == "XY":
                        base_shear = math.sqrt(vx**2 + vy**2)
                    else:
                        base_shear = max(vx, vy)

                    results.append(
                        {
                            "Case": case_name,
                            "Step": int(step_num),
                            "Displacement": float(displacement),
                            "BaseShear": float(base_shear),
                            "Direction": direction,
                        }
                    )

            if not results:
                return pd.DataFrame(), []

            result_df = pd.DataFrame(results)
            result_df = result_df.sort_values(["Case", "Step"]).reset_index(drop=True)

            # Normalize displacement (subtract initial value so curve starts at 0)
            for case_name in pushover_cases:
                case_mask = result_df["Case"] == case_name
                if case_mask.any():
                    initial_disp = result_df.loc[case_mask, "Displacement"].iloc[0]
                    result_df.loc[case_mask, "Displacement"] -= initial_disp

            return result_df, pushover_cases

        except Exception as e:
            logger.exception(f"Error parsing pushover curve data: {e}")
            return pd.DataFrame(), []

    # --- Time-Series Methods ---

    def parse_time_history(self) -> Optional[TimeHistoryParseResult]:
        """Parse all time-history (step-by-step) data from the Excel file.

        Returns:
            TimeHistoryParseResult containing all time series data, or None if no time-series data found
        """
        # Detect load case name
        load_case_name = self._detect_time_history_load_case()
        if not load_case_name:
            return None

        result = TimeHistoryParseResult(load_case_name=load_case_name)

        # Parse story drifts time series
        if self.validate_sheet_exists("Story Drifts"):
            result.drifts_x, result.drifts_y, result.stories = self._parse_story_drifts_timeseries()

        # Parse story forces time series
        if self.validate_sheet_exists("Story Forces"):
            forces_x, forces_y, _ = self._parse_story_forces_timeseries()
            result.forces_x = forces_x
            result.forces_y = forces_y

        # Parse joint displacements time series
        if self.validate_sheet_exists("Joint Displacements"):
            displ_x, displ_y, _ = self._parse_joint_displacements_timeseries()
            result.displacements_x = displ_x
            result.displacements_y = displ_y

        # Parse diaphragm accelerations time series
        if self.validate_sheet_exists("Diaphragm Accelerations"):
            accel_x, accel_y, _ = self._parse_diaphragm_accelerations_timeseries()
            result.accelerations_x = accel_x
            result.accelerations_y = accel_y

        # Check if we got any data
        has_data = (
            result.drifts_x
            or result.drifts_y
            or result.forces_x
            or result.forces_y
            or result.displacements_x
            or result.displacements_y
            or result.accelerations_x
            or result.accelerations_y
        )

        return result if has_data else None

    def _detect_time_history_load_case(self) -> Optional[str]:
        """Detect the load case name from Story Drifts sheet time-series data."""
        sheet = "Story Drifts"
        if not self.validate_sheet_exists(sheet):
            return None

        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
                nrows=100,  # Sample first rows
            )

            # Check for Step Type column indicating time-series data
            if "Step Type" not in df.columns:
                return None

            # Filter to Step By Step rows
            step_by_step = df[df["Step Type"] == "Step By Step"]
            if step_by_step.empty:
                return None

            # Get first output case name
            if "Output Case" in step_by_step.columns:
                return str(step_by_step["Output Case"].dropna().iloc[0])

            return None
        except Exception as e:
            logger.warning(f"Error detecting time history load case: {e}")
            return None

    def _parse_story_drifts_timeseries(
        self,
    ) -> Tuple[List[TimeSeriesData], List[TimeSeriesData], List[str]]:
        """Parse Story Drifts sheet for step-by-step time series data.

        Returns:
            Tuple of (drifts_x, drifts_y, story_order)
        """
        sheet = "Story Drifts"
        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
            )

            # Required columns: Story, Output Case, Step Type, Step Number, Direction, Drift
            required_cols = ["Story", "Output Case", "Step Type", "Direction", "Drift"]
            if not all(col in df.columns for col in required_cols):
                return [], [], []

            # Check for Step Number column (may be named differently)
            step_num_col = None
            for col in df.columns:
                if "step" in str(col).lower() and "type" not in str(col).lower():
                    step_num_col = col
                    break

            if step_num_col is None:
                return [], [], []

            # Filter to Step By Step rows only
            df = df[df["Step Type"] == "Step By Step"].copy()
            if df.empty:
                return [], [], []

            # Get story order (preserve first-occurrence order)
            story_order = df["Story"].dropna().unique().tolist()

            # Extract X direction
            drifts_x = self._extract_time_series_by_direction(
                df, "X", "Drift", step_num_col, story_order
            )

            # Extract Y direction
            drifts_y = self._extract_time_series_by_direction(
                df, "Y", "Drift", step_num_col, story_order
            )

            return drifts_x, drifts_y, story_order

        except Exception as e:
            logger.warning(f"Error parsing story drifts time series: {e}")
            return [], [], []

    def _parse_story_forces_timeseries(
        self,
    ) -> Tuple[List[TimeSeriesData], List[TimeSeriesData], List[str]]:
        """Parse Story Forces sheet for step-by-step time series data.

        Returns:
            Tuple of (forces_x, forces_y, story_order)
        """
        sheet = "Story Forces"
        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
            )

            # Check for Step Type column
            if "Step Type" not in df.columns:
                return [], [], []

            # Check for Step Number column
            step_num_col = None
            for col in df.columns:
                if "step" in str(col).lower() and "type" not in str(col).lower():
                    step_num_col = col
                    break

            if step_num_col is None:
                return [], [], []

            # Filter to Step By Step rows and Bottom location
            df = df[df["Step Type"] == "Step By Step"].copy()
            if "Location" in df.columns:
                df = df[df["Location"] == "Bottom"]

            if df.empty:
                return [], [], []

            # Get story order
            story_order = df["Story"].dropna().unique().tolist()

            # Extract VX (X direction shear)
            forces_x = self._extract_time_series_direct(df, "VX", "X", step_num_col, story_order)

            # Extract VY (Y direction shear)
            forces_y = self._extract_time_series_direct(df, "VY", "Y", step_num_col, story_order)

            return forces_x, forces_y, story_order

        except Exception as e:
            logger.warning(f"Error parsing story forces time series: {e}")
            return [], [], []

    def _parse_joint_displacements_timeseries(
        self,
    ) -> Tuple[List[TimeSeriesData], List[TimeSeriesData], List[str]]:
        """Parse Joint Displacements sheet for step-by-step time series data.

        Uses Label=1 joint (typically center of mass).

        Returns:
            Tuple of (displacements_x, displacements_y, story_order)
        """
        sheet = "Joint Displacements"
        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
            )

            # Check for Step Type column
            if "Step Type" not in df.columns:
                return [], [], []

            # Check for Step Number column
            step_num_col = None
            for col in df.columns:
                if "step" in str(col).lower() and "type" not in str(col).lower():
                    step_num_col = col
                    break

            if step_num_col is None:
                return [], [], []

            # Filter to Step By Step rows and Label=1 joint
            df = df[df["Step Type"] == "Step By Step"].copy()
            if "Label" in df.columns:
                df = df[df["Label"] == 1]

            if df.empty:
                return [], [], []

            # Get story order
            story_order = df["Story"].dropna().unique().tolist()

            # Extract Ux (X direction displacement)
            displacements_x = self._extract_time_series_direct(
                df, "Ux", "X", step_num_col, story_order
            )

            # Extract Uy (Y direction displacement)
            displacements_y = self._extract_time_series_direct(
                df, "Uy", "Y", step_num_col, story_order
            )

            return displacements_x, displacements_y, story_order

        except Exception as e:
            logger.warning(f"Error parsing joint displacements time series: {e}")
            return [], [], []

    def _parse_diaphragm_accelerations_timeseries(
        self,
    ) -> Tuple[List[TimeSeriesData], List[TimeSeriesData], List[str]]:
        """Parse Diaphragm Accelerations sheet for step-by-step time series data.

        Returns:
            Tuple of (accelerations_x, accelerations_y, story_order)
        """
        sheet = "Diaphragm Accelerations"
        try:
            df = self._get_excel_file().parse(
                sheet_name=sheet,
                skiprows=[0, 2],
            )

            # Check for Step Type column
            if "Step Type" not in df.columns:
                return [], [], []

            # Check for Step Number column
            step_num_col = None
            for col in df.columns:
                if "step" in str(col).lower() and "type" not in str(col).lower():
                    step_num_col = col
                    break

            if step_num_col is None:
                return [], [], []

            # Filter to Step By Step rows
            df = df[df["Step Type"] == "Step By Step"].copy()
            if df.empty:
                return [], [], []

            # Get story order
            story_order = df["Story"].dropna().unique().tolist()

            # Look for UX/UY columns (may be named Max UX, UX, etc.)
            ux_col = None
            uy_col = None
            for col in df.columns:
                col_lower = str(col).lower()
                if "ux" in col_lower and ux_col is None:
                    ux_col = col
                elif "uy" in col_lower and uy_col is None:
                    uy_col = col

            accelerations_x = []
            accelerations_y = []

            if ux_col:
                accelerations_x = self._extract_time_series_direct(
                    df, ux_col, "X", step_num_col, story_order
                )

            if uy_col:
                accelerations_y = self._extract_time_series_direct(
                    df, uy_col, "Y", step_num_col, story_order
                )

            return accelerations_x, accelerations_y, story_order

        except Exception as e:
            logger.warning(f"Error parsing diaphragm accelerations time series: {e}")
            return [], [], []

    def _extract_time_series_by_direction(
        self,
        df: pd.DataFrame,
        direction: str,
        value_col: str,
        step_num_col: str,
        story_order: List[str],
    ) -> List[TimeSeriesData]:
        """Extract time series for each story filtered by direction column."""
        result = []

        df_dir = df[df["Direction"] == direction]

        for idx, story in enumerate(story_order):
            story_df = df_dir[df_dir["Story"] == story].sort_values(step_num_col)

            if story_df.empty:
                continue

            time_steps = story_df[step_num_col].tolist()
            values = story_df[value_col].tolist()

            # Convert to float, handling any conversion issues
            try:
                time_steps = [float(t) for t in time_steps]
                values = [float(v) if pd.notna(v) else 0.0 for v in values]
            except (ValueError, TypeError):
                continue

            result.append(
                TimeSeriesData(
                    story=str(story),
                    direction=direction,
                    time_steps=time_steps,
                    values=values,
                    story_sort_order=idx,
                )
            )

        return result

    def _extract_time_series_direct(
        self,
        df: pd.DataFrame,
        value_col: str,
        direction: str,
        step_num_col: str,
        story_order: List[str],
    ) -> List[TimeSeriesData]:
        """Extract time series for each story from a direct value column."""
        result = []

        if value_col not in df.columns:
            return result

        for idx, story in enumerate(story_order):
            story_df = df[df["Story"] == story].sort_values(step_num_col)

            if story_df.empty:
                continue

            time_steps = story_df[step_num_col].tolist()
            values = story_df[value_col].tolist()

            # Convert to float, handling any conversion issues
            try:
                time_steps = [float(t) for t in time_steps]
                values = [float(v) if pd.notna(v) else 0.0 for v in values]
            except (ValueError, TypeError):
                continue

            result.append(
                TimeSeriesData(
                    story=str(story),
                    direction=direction,
                    time_steps=time_steps,
                    values=values,
                    story_sort_order=idx,
                )
            )

        return result

    def has_time_series_data(self) -> bool:
        """Quick check if the file contains step-by-step time series data."""
        return self._detect_time_history_load_case() is not None
