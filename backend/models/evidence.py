from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    proposition_id = Column(String(36), ForeignKey("propositions.id", ondelete="CASCADE"), nullable=False, index=True)
    source_title = Column(String(500), nullable=False)
    source_url = Column(String(2048), nullable=False)
    publisher = Column(String(255), nullable=False, default="Unknown Publisher")
    publication_date = Column(String(100), nullable=True)
    evidence_text = Column(Text, nullable=False)
    highlighted_excerpt = Column(Text, nullable=True)
    source_category = Column(String(64), nullable=False, default="Other sources")
    relevance_score = Column(Float, nullable=False, default=0.0)
    nli_label = Column(String(32), nullable=True)  # entailment | contradiction | neutral
    nli_score = Column(Float, nullable=True)
    stance = Column(String(32), nullable=False, default="neutral")  # supporting | contradicting | neutral
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    proposition = relationship("Proposition", back_populates="evidence_items")
