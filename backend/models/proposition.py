from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Proposition(Base):
    __tablename__ = "propositions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    article_id = Column(String(36), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True)
    claim_code = Column(String(16), nullable=False)  # P001, P002, ...
    claim_text = Column(Text, nullable=False)
    original_sentence = Column(Text, nullable=False)
    sentence_index = Column(Integer, nullable=False, default=0)
    claim_type = Column(String(64), nullable=False, default="Factual")
    verifiability = Column(String(64), nullable=False, default="Verifiable")
    entities = Column(JSON, nullable=False, default=list)
    dates = Column(JSON, nullable=False, default=list)
    numbers = Column(JSON, nullable=False, default=list)
    verification_status = Column(String(32), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    article = relationship("Article", back_populates="propositions")
    evidence_items = relationship(
        "Evidence",
        back_populates="proposition",
        cascade="all, delete-orphan",
        order_by="Evidence.relevance_score.desc()",
    )
    verification = relationship(
        "Verification",
        back_populates="proposition",
        uselist=False,
        cascade="all, delete-orphan",
    )
