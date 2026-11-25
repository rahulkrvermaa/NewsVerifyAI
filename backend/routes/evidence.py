from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.evidence import Evidence
from models.proposition import Proposition
from schemas.proposition_schema import EvidenceResponse
from schemas.verification_schema import EvidenceLibraryItem

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("", response_model=List[EvidenceLibraryItem])
def list_evidence_library(
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    query = db.query(Evidence).options(
        joinedload(Evidence.proposition).joinedload(Proposition.article)
    )

    if category and category != "ALL":
        query = query.filter(Evidence.source_category == category)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            Evidence.source_title.ilike(term)
            | Evidence.publisher.ilike(term)
            | Evidence.evidence_text.ilike(term)
        )

    rows = query.order_by(Evidence.created_at.desc()).limit(limit).all()

    items: List[EvidenceLibraryItem] = []
    for ev in rows:
        prop = ev.proposition
        article = prop.article if prop else None
        items.append(
            EvidenceLibraryItem(
                id=ev.id,
                proposition_id=ev.proposition_id,
                article_id=article.id if article else "",
                article_title=article.title if article else "Unknown Article",
                claim_code=prop.claim_code if prop else "P000",
                claim_text=prop.claim_text if prop else "",
                source_title=ev.source_title,
                source_url=ev.source_url,
                publisher=ev.publisher,
                publication_date=ev.publication_date,
                evidence_text=ev.evidence_text,
                highlighted_excerpt=ev.highlighted_excerpt,
                source_category=ev.source_category,
                relevance_score=ev.relevance_score,
                stance=ev.stance,
                created_at=ev.created_at,
            )
        )
    return items


@router.get("/{proposition_id}", response_model=List[EvidenceResponse])
def get_proposition_evidence(proposition_id: str, db: Session = Depends(get_db)):
    prop = db.query(Proposition).filter(Proposition.id == proposition_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proposition not found.")
    return (
        db.query(Evidence)
        .filter(Evidence.proposition_id == proposition_id)
        .order_by(Evidence.relevance_score.desc())
        .all()
    )
