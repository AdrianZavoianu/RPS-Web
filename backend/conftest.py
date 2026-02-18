"""Root conftest — reusable pytest fixtures for the RPS backend test suite.

Existing setUpTestData-based tests are unaffected; these fixtures are opt-in.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import CatalogProject
from apps.projects.models import Element, LoadCase, Project, Story
from apps.results.models import (
    ElementResultsCache,
    GlobalResultsCache,
    JointResultsCache,
    ResultSet,
)

User = get_user_model()


@pytest.fixture
def user(db):
    """Authenticated test user."""
    return User.objects.create_user(
        username="fixture-user",
        email="fixture-user@example.com",
        password="FixturePass!123",
    )


@pytest.fixture
def api_client():
    """Unauthenticated DRF APIClient."""
    return APIClient()


@pytest.fixture
def authenticated_client(user, api_client):
    """APIClient with Bearer token for *user*."""
    response = api_client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "FixturePass!123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api_client


@pytest.fixture
def catalog_project(user):
    """CatalogProject owned by *user*."""
    return CatalogProject.objects.create(
        name="Fixture Project",
        slug="fixture-project",
        owner=user,
        analysis_type="NLTHA",
    )


@pytest.fixture
def project(catalog_project):
    """Project linked to *catalog_project*."""
    return Project.objects.create(catalog_project=catalog_project)


@pytest.fixture
def project_with_data(project):
    """Full project with stories, load cases, elements, result set, and cache entries.

    Returns a namespace dict with all created objects for test assertions.
    """
    story_roof = Story.objects.create(project=project, name="Roof", sort_order=3)
    story_l2 = Story.objects.create(project=project, name="L2", sort_order=2)
    story_l1 = Story.objects.create(project=project, name="L1", sort_order=1)

    lc1 = LoadCase.objects.create(project=project, name="TH01", case_type="Time History")
    lc2 = LoadCase.objects.create(project=project, name="TH02", case_type="Time History")

    wall = Element.objects.create(
        project=project,
        element_type="Wall",
        name="W1",
        unique_name="W1",
        story=story_l1,
    )
    beam = Element.objects.create(
        project=project,
        element_type="Beam",
        name="B1",
        unique_name="B1",
        story=story_l1,
    )

    result_set = ResultSet.objects.create(
        project=project, name="DES", analysis_type="NLTHA"
    )

    # Global cache entries (Drifts_X for each story)
    global_caches = []
    for story, vals in [
        (story_roof, {"TH01": 0.003, "TH02": 0.004}),
        (story_l2, {"TH01": 0.005, "TH02": 0.006}),
        (story_l1, {"TH01": 0.002, "TH02": 0.001}),
    ]:
        numeric = list(vals.values())
        gc = GlobalResultsCache.objects.create(
            project=project,
            result_set=result_set,
            result_type="Drifts_X",
            story=story,
            results_matrix=vals,
            avg_value=sum(numeric) / len(numeric),
            max_value=max(numeric),
            min_value=min(numeric),
            load_case_count=len(numeric),
            story_sort_order=story.sort_order,
        )
        global_caches.append(gc)

    # Element cache entry
    element_cache = ElementResultsCache.objects.create(
        project=project,
        result_set=result_set,
        result_type="WallShears_V2",
        element=wall,
        story=story_l1,
        results_matrix={"TH01": 120.5, "TH02": 135.0},
        avg_value=127.75,
        max_value=135.0,
        min_value=120.5,
        load_case_count=2,
        story_sort_order=story_l1.sort_order,
    )

    # Joint cache entry
    joint_cache = JointResultsCache.objects.create(
        project=project,
        result_set=result_set,
        result_type="SoilPressures_Min",
        shell_object="FDN1",
        unique_name="FDN1-A",
        results_matrix={"TH01": -450.2, "TH02": -380.5},
        avg_value=-415.35,
        max_value=-380.5,
        min_value=-450.2,
        load_case_count=2,
    )

    return {
        "project": project,
        "stories": [story_roof, story_l2, story_l1],
        "load_cases": [lc1, lc2],
        "elements": {"wall": wall, "beam": beam},
        "result_set": result_set,
        "global_caches": global_caches,
        "element_cache": element_cache,
        "joint_cache": joint_cache,
    }
