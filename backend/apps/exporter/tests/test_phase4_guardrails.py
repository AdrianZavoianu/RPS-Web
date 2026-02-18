"""Phase 4 exporter guardrail and progress-throttle tests."""

from django.test import SimpleTestCase

from apps.exporter.serializers import ExportRequestSerializer
from apps.exporter.tasks import _should_persist_progress


class ExportRequestGuardrailTests(SimpleTestCase):
    """Validate request guardrails for oversized or invalid export payloads."""

    def test_accepts_valid_export_request(self):
        serializer = ExportRequestSerializer(
            data={
                "result_set_id": 1,
                "format": "excel",
                "result_types": ["Drifts", "Forces"],
                "element_types": ["ColumnRotations"],
                "joint_types": ["SoilPressures"],
                "directions": ["X", "Y"],
                "include_summary": True,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_unknown_element_type(self):
        serializer = ExportRequestSerializer(
            data={
                "result_set_id": 1,
                "format": "excel",
                "element_types": ["InvalidType"],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("element_types", serializer.errors)

    def test_rejects_oversized_selection_list(self):
        serializer = ExportRequestSerializer(
            data={
                "result_set_id": 1,
                "format": "excel",
                "result_types": ["Drifts"] * 33,
                "directions": ["X"],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("result_types", serializer.errors)
        self.assertIn("guardrail limit", serializer.errors["result_types"][0])

    def test_rejects_duplicate_directions(self):
        serializer = ExportRequestSerializer(
            data={
                "result_set_id": 1,
                "format": "excel",
                "result_types": ["Drifts"],
                "directions": ["X", "X"],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("directions", serializer.errors)
        self.assertIn("duplicate values", serializer.errors["directions"][0])

    def test_rejects_request_with_no_selected_types(self):
        serializer = ExportRequestSerializer(
            data={
                "result_set_id": 1,
                "format": "excel",
                "result_types": [],
                "element_types": [],
                "joint_types": [],
                "directions": ["X", "Y"],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class ExportProgressPersistThrottleTests(SimpleTestCase):
    """Validate throttled export progress persistence decisions."""

    def test_does_not_persist_when_current_does_not_advance(self):
        should_persist = _should_persist_progress(
            current=5,
            total=100,
            last_persisted_current=5,
            last_persisted_at=100.0,
            now=100.2,
        )
        self.assertFalse(should_persist)

    def test_persists_when_step_delta_reaches_threshold(self):
        should_persist = _should_persist_progress(
            current=10,
            total=100,
            last_persisted_current=5,
            last_persisted_at=100.0,
            now=100.2,
        )
        self.assertTrue(should_persist)

    def test_persists_when_time_interval_elapsed(self):
        should_persist = _should_persist_progress(
            current=6,
            total=100,
            last_persisted_current=5,
            last_persisted_at=100.0,
            now=101.5,
        )
        self.assertTrue(should_persist)

    def test_always_persists_when_completed(self):
        should_persist = _should_persist_progress(
            current=100,
            total=100,
            last_persisted_current=95,
            last_persisted_at=100.0,
            now=100.1,
        )
        self.assertTrue(should_persist)
