from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.article import Article
from models.evidence import Evidence
from models.proposition import Proposition
from schemas.proposition_schema import EvidenceResponse
from schemas.verification_schema import (
    DashboardStatsResponse,
    HistoryItemResponse,
    VerificationSummaryStats,
)

router = APIRouter(prefix="/api", tags=["history"])


def _summarize_article(article: Article) -> VerificationSummaryStats:
    supported = contradicted = insufficient = conflicting = 0
    for p in article.propositions:
        v = p.verification_status
        if v == "SUPPORTED":
            supported += 1
        elif v == "CONTRADICTED":
            contradicted += 1
        elif v == "CONFLICTING EVIDENCE":
            conflicting += 1
        else:
            insufficient += 1
    return VerificationSummaryStats(
        total_propositions=len(article.propositions),
        supported=supported,
        contradicted=contradicted,
        insufficient_evidence=insufficient,
        conflicting_evidence=conflicting,
    )


@router.get("/history", response_model=List[HistoryItemResponse])
def get_investigation_history(
    search: Optional[str] = Query(default=None),
    assessment: Optional[str] = Query(default=None),
    sort: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Article).options(joinedload(Article.propositions))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(Article.title.ilike(term) | Article.publisher.ilike(term))
    if assessment and assessment.strip() and assessment != "ALL":
        query = query.filter(Article.overall_assessment == assessment)

    order_col = Article.created_at.asc() if sort == "asc" else Article.created_at.desc()
    articles = query.order_by(order_col).all()

    return [
        HistoryItemResponse(
            id=a.id,
            title=a.title,
            input_type=a.input_type,
            publisher=a.publisher,
            publication_date=a.publication_date,
            created_at=a.created_at,
            analyzed_at=a.analyzed_at,
            proposition_count=len(a.propositions),
            overall_assessment=a.overall_assessment,
            summary=_summarize_article(a),
        )
        for a in articles
    ]


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    analyzed_articles = (
        db.query(Article)
        .options(joinedload(Article.propositions))
        .filter(Article.analyzed_at.isnot(None))
        .order_by(Article.analyzed_at.desc())
        .all()
    )

    total_props = 0
    supported = contradicted = insufficient = conflicting = 0

    for a in analyzed_articles:
        s = _summarize_article(a)
        total_props += s.total_propositions
        supported += s.supported
        contradicted += s.contradicted
        insufficient += s.insufficient_evidence
        conflicting += s.conflicting_evidence

    recent_investigations = [
        HistoryItemResponse(
            id=a.id,
            title=a.title,
            input_type=a.input_type,
            publisher=a.publisher,
            publication_date=a.publication_date,
            created_at=a.created_at,
            analyzed_at=a.analyzed_at,
            proposition_count=len(a.propositions),
            overall_assessment=a.overall_assessment,
            summary=_summarize_article(a),
        )
        for a in analyzed_articles[:6]
    ]

    recent_sources = (
        db.query(Evidence)
        .order_by(Evidence.created_at.desc())
        .limit(6)
        .all()
    )

    recent_props = (
        db.query(Proposition)
        .options(joinedload(Proposition.article))
        .filter(Proposition.verification_status != "PENDING")
        .order_by(Proposition.created_at.desc())
        .limit(8)
        .all()
    )

    latest_activity = [
        {
            "id": p.id,
            "article_id": p.article_id,
            "article_title": p.article.title if p.article else "Investigation",
            "claim_code": p.claim_code,
            "claim_text": p.claim_text,
            "verdict": p.verification_status,
            "timestamp": p.created_at.isoformat(),
        }
        for p in recent_props
    ]

    return DashboardStatsResponse(
        articles_analyzed=len(analyzed_articles),
        propositions_extracted=total_props,
        supported_claims=supported,
        contradicted_claims=contradicted,
        further_investigation_claims=insufficient + conflicting,
        conflicting_claims=conflicting,
        distribution={
            "Supported": supported,
            "Contradicted": contradicted,
            "Insufficient Evidence": insufficient,
            "Conflicting Evidence": conflicting,
        },
        recent_investigations=recent_investigations,
        recent_sources=[EvidenceResponse.model_validate(s) for s in recent_sources],
        latest_activity=latest_activity,
    )
