"""Focused unit tests for optimized detail element importer loops."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys
import types
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "services" / "detail_importers" / "elements.py"
MODULE_NAME = "apps.importer.services.detail_importers.elements_under_test"
_MISSING = object()


def _load_module(module_name: str, path: Path):
    spec = spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module spec: {module_name}")
    module = module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _package(module_name: str) -> types.ModuleType:
    package = types.ModuleType(module_name)
    package.__path__ = []
    return package


class _Captured:
    calls = []


def _bulk_create_strict(model, objects, context, key_builder):
    del key_builder
    _Captured.calls.append((model, list(objects), context))


def _to_float(value):
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:
        return None
    return parsed


class _Model:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakeSeries:
    def __init__(self, values):
        self._values = list(values)

    def to_numpy(self, copy=False):
        del copy
        return list(self._values)


class _FakeDataFrame:
    def __init__(self, columns):
        self._columns = {name: list(values) for name, values in columns.items()}
        self.columns = list(self._columns.keys())
        self.empty = not self._columns or len(next(iter(self._columns.values()))) == 0

    def __len__(self):
        if not self._columns:
            return 0
        return len(next(iter(self._columns.values())))

    def __getitem__(self, key):
        return _FakeSeries(self._columns[key])


class _Entity:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakeContext:
    def __init__(self):
        self.project = _Entity(id=1)
        self.result_set = _Entity(id=2)
        self.result_category = _Entity(id=3)

    def get_or_create_story(self, name, sort_order):
        return _Entity(name=name, sort_order=sort_order, id=10)

    def get_or_create_load_case(self, name):
        return _Entity(name=name, id=20)

    def get_or_create_element(self, *, element_type, name, unique_name, story):
        return _Entity(
            element_type=element_type,
            name=name,
            unique_name=unique_name,
            story=story,
            id=30,
        )


def _load_elements_module():
    originals = {}

    def _set_module(name: str, module: types.ModuleType) -> None:
        originals[name] = sys.modules.get(name, _MISSING)
        sys.modules[name] = module

    _set_module("apps", _package("apps"))
    _set_module("apps.importer", _package("apps.importer"))
    _set_module("apps.importer.services", _package("apps.importer.services"))
    _set_module(
        "apps.importer.services.detail_importers",
        _package("apps.importer.services.detail_importers"),
    )
    _set_module("apps.results", _package("apps.results"))

    results_models = types.ModuleType("apps.results.models")
    for model_name in [
        "BeamRotation",
        "ColumnAxial",
        "ColumnRotation",
        "ColumnShear",
        "QuadRotation",
        "WallShear",
    ]:
        setattr(results_models, model_name, type(model_name, (_Model,), {}))
    _set_module("apps.results.models", results_models)

    bulk_writes = types.ModuleType("apps.importer.services.bulk_writes")
    bulk_writes.bulk_create_strict = _bulk_create_strict
    _set_module("apps.importer.services.bulk_writes", bulk_writes)

    import_context = types.ModuleType("apps.importer.services.import_context")
    import_context.ImportContext = object
    _set_module("apps.importer.services.import_context", import_context)

    utils_module = types.ModuleType("apps.importer.services.utils")
    utils_module.to_float = _to_float
    _set_module("apps.importer.services.utils", utils_module)

    module = _load_module(MODULE_NAME, MODULE_PATH)

    for module_name, original in originals.items():
        if original is _MISSING:
            sys.modules.pop(module_name, None)
        else:
            sys.modules[module_name] = original

    return module


ELEMENTS_MODULE = _load_elements_module()


class DetailElementImportersTests(TestCase):
    def setUp(self):
        _Captured.calls.clear()
        self.context = _FakeContext()

    def test_import_quad_rotations_uses_column_arrays_and_step_fallbacks(self):
        df = _FakeDataFrame(
            {
                "Output Case": ["LC1", "LC1", "LC1", "LC2"],
                "Story": ["S1", "S1", "S1", "S1"],
                "PropertyName": ["Q1", "Q2", "Q3", "Q4"],
                "StepType": ["max", "min", "invalid", "max"],
                "MaxRotation": [1.5, 2.5, 3.5, 4.5],
                "MinRotation": [-1.0, -2.0, -3.0, -4.0],
                "Rotation": [None, None, None, None],
            }
        )

        ELEMENTS_MODULE.import_quad_rotations(
            context=self.context,
            df=df,
            load_cases=[],
            story_index={"S1": 7},
            piers=[],
            allowed_load_cases={"LC1"},
        )

        self.assertEqual(len(_Captured.calls), 1)
        model, objects, context_name = _Captured.calls[0]
        self.assertEqual(model.__name__, "QuadRotation")
        self.assertEqual(context_name, "quad rotations import")
        self.assertEqual(len(objects), 2)
        self.assertListEqual([obj.rotation for obj in objects], [1.5, -2.0])
        self.assertListEqual([obj.direction for obj in objects], ["Pier", "Pier"])
        self.assertListEqual([obj.quad_name for obj in objects], ["", ""])
        self.assertListEqual([obj.story_sort_order for obj in objects], [7, 7])

    def test_import_beam_rotations_uses_legacy_column_fallbacks(self):
        df = _FakeDataFrame(
            {
                "OutputCase": ["LC1", "LC1", "LC1", "LC2", "LC1"],
                "Story": ["S1", "S1", "S1", "S1", "S1"],
                "FrameWall": ["B1", "B2", "B3", "B4", "B5"],
                "UniqueName": [None, "U2", "", None, None],
                "StepType": ["max", "foo", "nan", "max", "bar"],
                "GeneratedHinge": ["G1", "", "", "", ""],
                "RelDist": [0.1, 0.2, 0.3, 0.4, 0.5],
                "R3Plastic": [0.01, "bad", 0.03, 0.04, 0.05],
            }
        )

        ELEMENTS_MODULE.import_beam_rotations(
            context=self.context,
            df=df,
            load_cases=[],
            story_index={"S1": 4},
            beams=[],
            allowed_load_cases={"LC1"},
        )

        self.assertEqual(len(_Captured.calls), 1)
        model, objects, context_name = _Captured.calls[0]
        self.assertEqual(model.__name__, "BeamRotation")
        self.assertEqual(context_name, "beam rotations import")
        self.assertEqual(len(objects), 3)
        self.assertListEqual([obj.step_type for obj in objects], ["Max", "", "bar"])
        self.assertListEqual([obj.r3_plastic for obj in objects], [0.01, 0.03, 0.05])
        self.assertListEqual([obj.generated_hinge for obj in objects], ["G1", "", ""])
        self.assertListEqual([obj.hinge for obj in objects], ["", "", ""])
        self.assertListEqual([obj.story_sort_order for obj in objects], [4, 4, 4])
        self.assertListEqual(
            [obj.element.unique_name for obj in objects],
            ["B1", "B3", "B5"],
        )

    def test_import_wall_shears_handles_missing_location_column(self):
        df = _FakeDataFrame(
            {
                "Output Case": ["LC1", "LC2"],
                "Story": ["S1", "S1"],
                "Pier": ["W1", "W1"],
                "V2": [10.0, 20.0],
                "V3": [-5.0, -6.0],
            }
        )

        ELEMENTS_MODULE.import_wall_shears(
            context=self.context,
            df=df,
            load_cases=[],
            story_index={"S1": 1},
            piers=[],
            allowed_load_cases={"LC1"},
        )

        self.assertEqual(len(_Captured.calls), 1)
        model, objects, context_name = _Captured.calls[0]
        self.assertEqual(model.__name__, "WallShear")
        self.assertEqual(context_name, "wall shears import")
        self.assertEqual(len(objects), 2)
        self.assertSetEqual({obj.direction for obj in objects}, {"V2", "V3"})
        self.assertTrue(all(obj.location == "Bottom" for obj in objects))

    def test_import_column_forces_handles_missing_location_column(self):
        df = _FakeDataFrame(
            {
                "Output Case": ["LC1", "LC1"],
                "Story": ["S1", "S1"],
                "Column": ["C1", "C1"],
                "Unique Name": ["C1", "C1"],
                "V2": [4.0, -8.0],
                "V3": [2.0, -3.0],
                "P": [100.0, -120.0],
            }
        )

        ELEMENTS_MODULE.import_column_forces(
            context=self.context,
            df=df,
            load_cases=[],
            story_index={"S1": 2},
            columns=[],
            allowed_load_cases={"LC1"},
        )

        self.assertEqual(len(_Captured.calls), 2)
        (shear_model, shears, shear_context), (axial_model, axials, axial_context) = _Captured.calls

        self.assertEqual(shear_model.__name__, "ColumnShear")
        self.assertEqual(shear_context, "column shears import")
        self.assertEqual(len(shears), 2)
        self.assertTrue(all(obj.location == "" for obj in shears))

        self.assertEqual(axial_model.__name__, "ColumnAxial")
        self.assertEqual(axial_context, "column axials import")
        self.assertEqual(len(axials), 1)
        self.assertEqual(axials[0].location, "")
