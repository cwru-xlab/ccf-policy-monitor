"""SQLAlchemy 2.0 relational model for the medical policy monitoring prototype.

Policy and guideline criteria retain their text and concept words for the RAG
pipeline, with each criterion linked directly to its parent document model.
"""

from __future__ import annotations

import enum
import os
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Table,
    Text,
    Uuid,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)
from sqlalchemy.types import JSON, TypeDecorator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StringArray(TypeDecorator):
    """PostgreSQL ARRAY(String) with JSON storage on SQLite for local tests."""

    impl = ARRAY(String)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(JSON())


class PolicyDocType(enum.Enum):
    MEDICAL = "Medical"
    PHARMACY = "Pharmacy"
    BEHAVIORAL = "Behavioral"


class UpdateKind(enum.Enum):
    ADDITION = "Addition"
    REVISION = "Revision"
    DELETION = "Deletion"


class UpdateStatus(enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        native_enum=True,
        values_callable=lambda members: [member.value for member in members],
    )


class Base(DeclarativeBase):
    pass


policy_codes = Table(
    "policy_codes",
    Base.metadata,
    Column(
        "policy_number",
        String,
        ForeignKey("policy.policy_number", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "code_id",
        Uuid,
        ForeignKey("code.code_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class SourceDocument(Base):
    __tablename__ = "source_document"

    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    source_key: Mapped[str] = mapped_column(String, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=func.now(),
    )
    storage_uri: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    origin_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    guidelines: Mapped[list[Guideline]] = relationship(
        back_populates="document"
    )
    policy_criterion_updates: Mapped[list[PolicyCriterionUpdate]] = relationship(
        back_populates="document"
    )
    guideline_criterion_updates: Mapped[list[GuidelineCriterionUpdate]] = relationship(
        back_populates="document"
    )


class Policy(Base):
    __tablename__ = "policy"

    policy_number: Mapped[str] = mapped_column(String, primary_key=True)
    doc_type: Mapped[PolicyDocType] = mapped_column(
        _pg_enum(PolicyDocType, "policy_doc_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    coverage_effect: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_reviewed: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    watched_triggers: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    criteria: Mapped[list[PolicyCriterion]] = relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    codes: Mapped[list[Code]] = relationship(
        secondary=policy_codes,
        back_populates="policies",
    )
    matches: Mapped[list[CriterionMatch]] = relationship(
        back_populates="policy"
    )


class Guideline(Base):
    __tablename__ = "guideline"

    guideline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    source_key: Mapped[str] = mapped_column(String, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("source_document.document_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    published: Mapped[date] = mapped_column(Date, nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    strength: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    strength_system: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    document: Mapped[SourceDocument] = relationship(back_populates="guidelines")
    criteria: Mapped[list[GuidelineCriterion]] = relationship(
        back_populates="guideline",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    matches: Mapped[list[CriterionMatch]] = relationship(
        back_populates="guideline"
    )


class PolicyCriterion(Base):
    __tablename__ = "policy_criterion"

    criterion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    concept_words: Mapped[list[str]] = mapped_column(
        # postgresql.ARRAY(String); JSON fallback on SQLite via StringArray
        StringArray(),
        nullable=False,
        default=list,
    )
    needs_update: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    policy_number: Mapped[str] = mapped_column(
        String,
        ForeignKey("policy.policy_number", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    policy: Mapped[Policy] = relationship(back_populates="criteria")
    updates: Mapped[list[PolicyCriterionUpdate]] = relationship(
        back_populates="criterion",
        foreign_keys="PolicyCriterionUpdate.criterion_id",
    )
    policy_matches: Mapped[list[CriterionMatch]] = relationship(
        back_populates="policy_criterion",
        foreign_keys="CriterionMatch.policy_criterion_id",
    )


class GuidelineCriterion(Base):
    __tablename__ = "guideline_criterion"

    criterion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    concept_words: Mapped[list[str]] = mapped_column(
        # postgresql.ARRAY(String); JSON fallback on SQLite via StringArray
        StringArray(),
        nullable=False,
        default=list,
    )
    needs_update: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    guideline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("guideline.guideline_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    guideline: Mapped[Guideline] = relationship(back_populates="criteria")
    updates: Mapped[list[GuidelineCriterionUpdate]] = relationship(
        back_populates="criterion",
        foreign_keys="GuidelineCriterionUpdate.criterion_id",
    )
    guideline_matches: Mapped[list[CriterionMatch]] = relationship(
        back_populates="guideline_criterion",
        foreign_keys="CriterionMatch.guideline_criterion_id",
    )


class Code(Base):
    __tablename__ = "code"

    code_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    system: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(String, nullable=False)

    policies: Mapped[list[Policy]] = relationship(
        secondary=policy_codes,
        back_populates="codes",
    )


class CriterionMatch(Base):
    __tablename__ = "criterion_match"

    match_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    guideline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("guideline.guideline_id", ondelete="CASCADE"),
        nullable=False,
    )
    guideline_criterion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("guideline_criterion.criterion_id", ondelete="CASCADE"),
        nullable=False,
    )
    policy_number: Mapped[str] = mapped_column(
        String,
        ForeignKey("policy.policy_number", ondelete="CASCADE"),
        nullable=False,
    )
    policy_criterion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("policy_criterion.criterion_id", ondelete="SET NULL"),
        nullable=True,
    )
    similarity: Mapped[float] = mapped_column(Float, nullable=False)
    divergence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    guideline: Mapped[Guideline] = relationship(back_populates="matches")
    policy: Mapped[Policy] = relationship(back_populates="matches")
    guideline_criterion: Mapped[GuidelineCriterion] = relationship(
        back_populates="guideline_matches",
        foreign_keys=[guideline_criterion_id],
    )
    policy_criterion: Mapped[Optional[PolicyCriterion]] = relationship(
        back_populates="policy_matches",
        foreign_keys=[policy_criterion_id],
    )


class PolicyCriterionUpdate(Base):
    __tablename__ = "policy_criterion_update"

    update_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("policy_criterion.criterion_id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[UpdateKind] = mapped_column(
        _pg_enum(UpdateKind, "update_kind"), nullable=False
    )
    origin: Mapped[str] = mapped_column(String, nullable=False)
    revised_criterion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("policy_criterion.criterion_id", ondelete="SET NULL"),
        nullable=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("source_document.document_id", ondelete="SET NULL"),
        nullable=True,
    )
    editor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=func.now(),
    )
    status: Mapped[UpdateStatus] = mapped_column(
        _pg_enum(UpdateStatus, "update_status"), nullable=False
    )

    criterion: Mapped[PolicyCriterion] = relationship(
        back_populates="updates",
        foreign_keys=[criterion_id],
    )
    revised_criterion: Mapped[Optional[PolicyCriterion]] = relationship(
        foreign_keys=[revised_criterion_id],
    )
    document: Mapped[Optional[SourceDocument]] = relationship(
        back_populates="policy_criterion_updates"
    )


class GuidelineCriterionUpdate(Base):
    __tablename__ = "guideline_criterion_update"

    update_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("guideline_criterion.criterion_id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[UpdateKind] = mapped_column(
        _pg_enum(UpdateKind, "update_kind"), nullable=False
    )
    origin: Mapped[str] = mapped_column(String, nullable=False)
    revised_criterion_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("guideline_criterion.criterion_id", ondelete="SET NULL"),
        nullable=True,
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("source_document.document_id", ondelete="SET NULL"),
        nullable=True,
    )
    editor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=func.now(),
    )
    status: Mapped[UpdateStatus] = mapped_column(
        _pg_enum(UpdateStatus, "update_status"), nullable=False
    )

    criterion: Mapped[GuidelineCriterion] = relationship(
        back_populates="updates",
        foreign_keys=[criterion_id],
    )
    revised_criterion: Mapped[Optional[GuidelineCriterion]] = relationship(
        foreign_keys=[revised_criterion_id],
    )
    document: Mapped[Optional[SourceDocument]] = relationship(
        back_populates="guideline_criterion_updates"
    )


def get_engine(url: Optional[str] = None, *, echo: bool = False):
    database_url = url or os.getenv("DATABASE_URL", "sqlite:///policy_monitor.db")
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(database_url, echo=echo, connect_args=connect_args)


def get_session_factory(engine=None):
    engine = engine or get_engine()
    return sessionmaker(bind=engine, expire_on_commit=False)


if __name__ == "__main__":
    # SQLite in-memory for local schema checks; override with DATABASE_URL
    # for a real PostgreSQL instance, e.g.
    # postgresql+psycopg://user:pass@localhost:5432/policy_monitor
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    print("Schema created:", sorted(Base.metadata.tables))
