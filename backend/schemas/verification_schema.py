from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel

from schemas.article_schema import ArticleResponse
from schemas.proposition_schema import EvidenceResponse, PropositionResponse


class VerificationSummaryStats(BaseModel):
    total_propositions: int
    supported: int
    contradicted: int
    insufficient_evidence: int
    conflicting_evidence: int


class InvestigationReportResponse(BaseModel):
    article: ArticleResponse
    summary: VerificationSummaryStats
    propositions: List[PropositionResponse]
    latest_job_status: Optional[str] = None


class HistoryItemResponse(BaseModel):
    id: str
    title: str
    input_type: str
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    created_at: datetime
    analyzed_at: Optional[datetime] = None
    proposition_count: int
    overall_assessment: Optional[str] = None
    summary: VerificationSummaryStats


class DashboardStatsResponse(BaseModel):
    articles_analyzed: int
    propositions_extracted: int
    supported_claims: int
    contradicted_claims: int
    further_investigation_claims: int
    conflicting_claims: int
    distribution: Dict[str, int]
    recent_investigations: List[HistoryItemResponse]
    recent_sources: List[EvidenceResponse]
    latest_activity: List[Dict[str, str]]


class EvidenceLibraryItem(BaseModel):
    id: str
    proposition_id: str
    article_id: str
    article_title: str
    claim_code: str
    claim_text: str
    source_title: str
    source_url: str
    publisher: str
    publication_date: Optional[str] = None
    evidence_text: str
    highlighted_excerpt: Optional[str] = None
    source_category: str
    relevance_score: float
    stance: str
    created_at: datetime
