from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    proposition_id = Column(String(36), ForeignKey("propositions.id", ondelete="CASCADE"), nullable=False, unique=True)
    verdict = Column(String(32), nullable=False)  # SUPPORTED | CONTRADICTED | INSUFFICIENT EVIDENCE | CONFLICTING EVIDENCE
    explanation = Column(Text, nullable=False)
    supporting_evidence_ids = Column(JSON, nullable=False, default=list)
    contradicting_evidence_ids = Column(JSON, nullable=False, default=list)
    confidence = Column(Float, nullable=True)
    search_queries = Column(JSON, nullable=False, default=list)
    verified_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    proposition = relationship("Proposition", back_populates="verification")
