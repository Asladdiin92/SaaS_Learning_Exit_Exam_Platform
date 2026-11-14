from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers

from backend.app.content.schemas import ResourceListItem
from backend.app.content.service import ContentService
from backend.app.main import app
from backend.app.database.models import (
    CourseChapter,
    CourseResource,
    ResourceCategory,
    course_resource_categories,
)


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value


class FakeSession:
    def __init__(self, results):
        self.results = iter(results)
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return next(self.results)


@pytest.mark.asyncio
async def test_resource_listing_returns_chapter_term_categories_and_filters():
    chapter = SimpleNamespace(
        chapter_id=42,
        chapter_number=3,
        title="Relational Databases",
        academic_year_label="2018 E.C.",
        semester=1,
    )
    category = SimpleNamespace(
        category_id=8,
        slug="database-systems",
        name="Database Systems",
        is_active=True,
    )
    resource = SimpleNamespace(
        resource_id=uuid4(),
        course_id=1,
        chapter_id=chapter.chapter_id,
        chapter=chapter,
        categories=[category],
        tenant_id=None,
        type="LECTURE_NOTE",
        title="Database Design Notes",
        storage_bucket="course-packages",
        file_size_bytes=100,
        sha256_checksum="a" * 64,
        is_offline_eligible=True,
        version=1,
        metadata_={},
        published_at=None,
    )
    db = FakeSession(
        [
            FakeResult(SimpleNamespace(course_id=1)),
            FakeResult([resource]),
            FakeResult([]),
        ]
    )

    response = await ContentService.get_course_resources(
        db=db,
        course_id=1,
        user_id=uuid4(),
        resource_type="LECTURE_NOTE",
        chapter_id=chapter.chapter_id,
        academic_year_label=chapter.academic_year_label,
        semester=chapter.semester,
        category=category.slug,
    )

    item = response.resources[0]
    assert item.chapter_id == chapter.chapter_id
    assert item.chapter_number == chapter.chapter_number
    assert item.chapter_title == chapter.title
    assert item.academic_year_label == chapter.academic_year_label
    assert item.semester == chapter.semester
    assert [(tag.slug, tag.name) for tag in item.categories] == [
        (category.slug, category.name)
    ]

    compiled_query = str(
        db.statements[1].compile(dialect=postgresql.dialect())
    )
    assert "course_resources.chapter_id" in compiled_query
    assert "course_chapters.academic_year_label" in compiled_query
    assert "course_chapters.semester" in compiled_query
    assert "resource_categories.slug" in compiled_query


def test_resource_taxonomy_orm_relationships_are_consistent():
    configure_mappers()
    chapter_fk = next(
        constraint
        for constraint in CourseResource.__table__.foreign_key_constraints
        if constraint.name == "fk_course_resources_chapter_course"
    )
    assert {column.name for column in chapter_fk.columns} == {
        "chapter_id",
        "course_id",
    }
    assert "academic_year_label" in CourseChapter.__table__.columns
    assert "semester" in CourseChapter.__table__.columns
    assert {"slug", "name"}.issubset(ResourceCategory.__table__.columns.keys())
    assert course_resource_categories.primary_key.columns.keys() == [
        "resource_id",
        "category_id",
    ]


def test_resource_response_keeps_chapter_optional_for_course_wide_materials():
    item = ResourceListItem(
        resource_id=uuid4(),
        course_id=1,
        type="REFERENCE_BOOK",
        title="Course-wide reference",
        storage_bucket="course-packages",
        file_size_bytes=10,
        is_offline_eligible=True,
        version=1,
    )

    assert item.chapter_id is None
    assert item.academic_year_label is None
    assert item.semester is None
    assert item.categories == []


def test_resource_endpoint_exposes_curriculum_placement_filters():
    operation = app.openapi()["paths"]["/api/v1/courses/{course_id}/resources"]["get"]
    query_parameters = {
        parameter["name"]: parameter
        for parameter in operation["parameters"]
        if parameter["in"] == "query"
    }

    assert {"chapter_id", "academic_year_label", "semester", "category"} <= set(
        query_parameters
    )
    semester_value_schema = next(
        schema
        for schema in query_parameters["semester"]["schema"]["anyOf"]
        if schema.get("type") == "integer"
    )
    assert semester_value_schema["minimum"] == 1
    assert semester_value_schema["maximum"] == 2
