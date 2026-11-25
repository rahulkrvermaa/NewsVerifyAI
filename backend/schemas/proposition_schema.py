from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class EvidenceResponse(BaseModel):
    id: str
    proposition_id: str
    source_title: str
    source_url: str
    publisher: str
    publication_date: Optional[str] = None
    evidence_text: str
    highlighted_excerpt: Optional[str] = None
    source_category: str
    relevance_score: float
    nli_label: Optional[str] = None
    nli_score: Optional[float] = None
    stance: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VerificationResponse(BaseModel):
    id: str
    proposition_id: str
    verdict: str
    explanation: str
    supporting_evidence_ids: List[str]
    contradicting_evidence_ids: List[str]
    confidence: Optional[float] = None
    search_queries: List[str]
    verified_at: datetime

    model_config = {"from_attributes": True}


class PropositionResponse(BaseModel):
    id: str
    article_id: str
    claim_code: str
    claim_text: str
    original_sentence: str
    sentence_index: int
    claim_type: str
    verifiability: str
    entities: List[str]
    dates: List[str]
    numbers: List[str]
    verification_status: str
    evidence_count: int = 0
    confidence: Optional[float] = None
    verification: Optional[VerificationResponse] = None
    evidence_items: List[EvidenceResponse] = []

    model_config = {"from_attributes": True}
