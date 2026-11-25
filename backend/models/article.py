from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Article(Base):
    __tablename__ = "articles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False, default="Untitled Investigation")
    original_text = Column(Text, nullable=False)
    input_type = Column(String(20), nullable=False)  # paste | url | upload
    original_url = Column(String(2048), nullable=True)
    publisher = Column(String(255), nullable=True)
    publication_date = Column(String(100), nullable=True)
    author = Column(String(255), nullable=True)
    language = Column(String(32), nullable=False, default="en")
    word_count = Column(Integer, nullable=False, default=0)
    char_count = Column(Integer, nullable=False, default=0)
    overall_assessment = Column(String(64), nullable=True)
    overall_summary = Column(Text, nullable=True)
    important_findings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)

    propositions = relationship(
        "Proposition",
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="Proposition.sentence_index",
    )
    jobs = relationship(
        "AnalysisJob",
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="AnalysisJob.created_at.desc()",
    )


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    article_id = Column(String(36), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(24), nullable=False, default="queued")  # queued | running | completed | failed
    stage = Column(String(64), nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    message = Column(String(500), nullable=False, default="Queued for verification")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    article = relationship("Article", back_populates="jobs")
