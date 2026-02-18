"""Tests for pushover_service — curve data assembly."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import CatalogProject
from apps.projects.models import Project
from apps.results.models import PushoverCase, PushoverCurvePoint, ResultSet
from apps.results.services.pushover_service import (
    get_curve_data_for_case,
    get_curves_batch_data,
)

User = get_user_model()


class _PushoverTestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="push-user",
            email="push@example.com",
            password="PushPass!123",
        )
        cls.catalog = CatalogProject.objects.create(
            name="Pushover Project",
            slug="pushover-project",
            owner=cls.user,
            analysis_type="Pushover",
        )
        cls.project = Project.objects.create(catalog_project=cls.catalog)
        cls.result_set = ResultSet.objects.create(
            project=cls.project, name="RS-PUSH", analysis_type="Pushover"
        )


class GetCurveDataForCaseTests(_PushoverTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.case = PushoverCase.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            name="Push_X+",
            direction="X",
        )
        PushoverCurvePoint.objects.create(
            pushover_case=cls.case, step_number=0, displacement=10.0, base_shear=0.0
        )
        PushoverCurvePoint.objects.create(
            pushover_case=cls.case, step_number=1, displacement=15.0, base_shear=500.0
        )
        PushoverCurvePoint.objects.create(
            pushover_case=cls.case, step_number=2, displacement=25.0, base_shear=800.0
        )

    def test_case_metadata(self):
        data = get_curve_data_for_case(self.case)
        self.assertEqual(data["case"]["id"], self.case.id)
        self.assertEqual(data["case"]["name"], "Push_X+")
        self.assertEqual(data["case"]["direction"], "X")

    def test_points_ordered(self):
        data = get_curve_data_for_case(self.case)
        steps = [p["step"] for p in data["points"]]
        self.assertEqual(steps, [0, 1, 2])

    def test_displacement_relative_to_step_0(self):
        data = get_curve_data_for_case(self.case)
        # Step 0 displacement is 10.0, so relative displacements should be 0, 5, 15
        displacements = [p["displacement"] for p in data["points"]]
        self.assertAlmostEqual(displacements[0], 0.0)
        self.assertAlmostEqual(displacements[1], 5.0)
        self.assertAlmostEqual(displacements[2], 15.0)

    def test_single_point(self):
        single_case = PushoverCase.objects.create(
            project=self.project,
            result_set=self.result_set,
            name="Push_Single",
            direction="X",
        )
        PushoverCurvePoint.objects.create(
            pushover_case=single_case, step_number=0, displacement=5.0, base_shear=100.0
        )
        data = get_curve_data_for_case(single_case)
        self.assertEqual(len(data["points"]), 1)
        self.assertAlmostEqual(data["points"][0]["displacement"], 0.0)


class GetCurvesBatchDataTests(_PushoverTestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.case_x = PushoverCase.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            name="Push_Batch_X+",
            direction="X",
        )
        PushoverCurvePoint.objects.create(
            pushover_case=cls.case_x, step_number=0, displacement=0.0, base_shear=0.0
        )
        cls.case_y = PushoverCase.objects.create(
            project=cls.project,
            result_set=cls.result_set,
            name="Push_Batch_Y+",
            direction="Y",
        )
        PushoverCurvePoint.objects.create(
            pushover_case=cls.case_y, step_number=0, displacement=0.0, base_shear=0.0
        )

    def test_curves_for_direction(self):
        data = get_curves_batch_data(
            project=self.project,
            result_set_id=self.result_set.id,
            direction="X",
        )
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["case"]["direction"], "X")

    def test_filters_by_direction(self):
        data = get_curves_batch_data(
            project=self.project,
            result_set_id=self.result_set.id,
            direction="Y",
        )
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["case"]["direction"], "Y")

    def test_empty_list_for_missing_direction(self):
        data = get_curves_batch_data(
            project=self.project,
            result_set_id=self.result_set.id,
            direction="XY",
        )
        self.assertEqual(data, [])

    def test_ordered_by_name(self):
        PushoverCase.objects.create(
            project=self.project,
            result_set=self.result_set,
            name="A_Push_X",
            direction="X",
        )
        data = get_curves_batch_data(
            project=self.project,
            result_set_id=self.result_set.id,
            direction="X",
        )
        names = [d["case"]["name"] for d in data]
        self.assertEqual(names, sorted(names))
