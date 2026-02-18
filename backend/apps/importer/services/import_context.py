"""Shared import context and cached model lookups for importer pipelines."""

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from apps.projects.models import Element, LoadCase, Project, Story
from apps.results.models import ResultCategory, ResultSet


@dataclass
class ImportContext:
    """Context container for import pipelines with cached get-or-create helpers."""

    project: Project
    result_set: ResultSet
    result_category: ResultCategory
    stories_map: Dict[str, Story] = field(default_factory=dict)
    load_cases_map: Dict[str, LoadCase] = field(default_factory=dict)
    elements_map: Dict[Tuple[str, str], Element] = field(default_factory=dict)

    def get_or_create_story(self, story_name: str, sort_order: int) -> Story:
        if story_name in self.stories_map:
            return self.stories_map[story_name]

        story, _ = Story.objects.get_or_create(
            project=self.project,
            name=story_name,
            defaults={"sort_order": sort_order},
        )
        self.stories_map[story_name] = story
        return story

    def get_or_create_load_case(self, case_name: str) -> LoadCase:
        if case_name in self.load_cases_map:
            return self.load_cases_map[case_name]

        load_case, _ = LoadCase.objects.get_or_create(
            project=self.project,
            name=case_name,
            defaults={"case_type": "Time History"},
        )
        self.load_cases_map[case_name] = load_case
        return load_case

    def get_or_create_element(
        self,
        *,
        element_type: str,
        name: str,
        unique_name: str,
        story: Optional[Story],
    ) -> Element:
        cache_key = (element_type, unique_name)
        if cache_key in self.elements_map:
            return self.elements_map[cache_key]

        element, _ = Element.objects.get_or_create(
            project=self.project,
            element_type=element_type,
            unique_name=unique_name,
            defaults={
                "name": name,
                "story": story,
            },
        )
        self.elements_map[cache_key] = element
        return element
