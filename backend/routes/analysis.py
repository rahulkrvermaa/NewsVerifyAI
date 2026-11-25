import asyncio
from datetime import datetime, timezone
import json
import threading
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session, joinedload

from config import get_settings
from database import SessionLocal, get_db
from models.article import AnalysisJob, Article
from models.evidence import Evidence
from models.proposition import Proposition
from models.verification import Verification
from schemas.article_schema import AnalysisJobResponse, ArticleResponse
from schemas.proposition_schema import PropositionResponse
from schemas.verification_schema import InvestigationReportResponse, VerificationSummaryStats
from services.evidence_retriever import rank_evidence_hybrid
from services.llm_verifier import synthesize_verdict
from services.nli_verifier import verify_evidence_nli_batch
from services.preprocessing import preprocess_text
from services.proposition_extractor import PipelineConfigError, extract_propositions
from services.query_generator import generate_search_queries
from services.report_generator import compute_article_report
from services.search_service import search_evidence_tavily

router = APIRouter(prefix="/api", tags=["analysis"])
limiter = Limiter(key_func=get_remote_address)


def _update_job(db: Session, job_id: str, *, status: str, stage: str, progress: int, message: str, error: str | None = None):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        return
    job.status = status
    job.stage = stage
    job.progress = progress
    job.message = message
    job.error = error
    job.updated_at = datetime.now(timezone.utc)
    db.commit()


def _verify_single_proposition(db: Session, prop: Proposition, queries: List[str]) -> str:
    """Retrieve evidence, run batched NLI + LLM synthesis, and persist results for one proposition."""
    db.query(Evidence).filter(Evidence.proposition_id == prop.id).delete()
    db.query(Verification).filter(Verification.proposition_id == prop.id).delete()
    db.commit()

    raw_sources = search_evidence_tavily(queries)
    ranked = rank_evidence_hybrid(prop.claim_text, raw_sources, top_k=6)
    nli_results = verify_evidence_nli_batch(
        [r.source.evidence_text for r in ranked],
        prop.claim_text,
    )

    evidence_models: List[Evidence] = []
    for r, nli in zip(ranked, nli_results):
        ev = Evidence(
            proposition_id=prop.id,
            source_title=r.source.source_title,
            source_url=r.source.source_url,
            publisher=r.source.publisher,
            publication_date=r.source.publication_date,
            evidence_text=r.source.evidence_text,
            highlighted_excerpt=r.highlighted_excerpt,
            source_category=r.source.source_category,
            relevance_score=r.relevance_score,
            nli_label=nli.label,
            nli_score=nli.score,
            stance=nli.stance,
        )
        db.add(ev)
        evidence_models.append(ev)
    db.commit()
    for ev in evidence_models:
        db.refresh(ev)

    synthesized = synthesize_verdict(prop.claim_text, ranked, nli_results)
    sup_ids = [evidence_models[i - 1].id for i in synthesized.supporting_indices if 1 <= i <= len(evidence_models)]
    con_ids = [evidence_models[i - 1].id for i in synthesized.contradicting_indices if 1 <= i <= len(evidence_models)]

    for ev in evidence_models:
        if ev.id in sup_ids:
            ev.stance = "supporting"
        elif ev.id in con_ids:
            ev.stance = "contradicting"

    prop.verification_status = synthesized.verdict
    ver = Verification(
        proposition_id=prop.id,
        verdict=synthesized.verdict,
        explanation=synthesized.explanation,
        supporting_evidence_ids=sup_ids,
        contradicting_evidence_ids=con_ids,
        confidence=synthesized.confidence,
        search_queries=queries,
    )
    db.add(ver)
    db.commit()
    return synthesized.verdict


def _run_pipeline_background(article_id: str, job_id: str) -> None:
    db = SessionLocal()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            _update_job(db, job_id, status="failed", stage="failed", progress=0, message="Article not found", error="Article not found")
            return

        # Clear any prior propositions if re-analyzing
        db.query(Proposition).filter(Proposition.article_id == article_id).delete()
        db.commit()

        # Stage 1: Preprocessing
        _update_job(db, job_id, status="running", stage="Extracting article", progress=12, message="Preprocessing text, sentences, and named entities...")
        preprocessed = preprocess_text(article.original_text)

        # Stage 2: Proposition extraction
        _update_job(db, job_id, status="running", stage="Identifying propositions", progress=26, message="Identifying atomic verifiable factual propositions...")
        raw_props = extract_propositions(preprocessed, title=article.title)

        if not raw_props:
            assessment, summary, findings = compute_article_report([])
            article.overall_assessment = assessment
            article.overall_summary = summary
            article.important_findings = findings
            article.analyzed_at = datetime.now(timezone.utc)
            db.commit()
            _update_job(db, job_id, status="completed", stage="completed", progress=100, message="Analysis complete (no verifiable factual claims found).")
            return

        prop_records: List[Proposition] = []
        for p in raw_props:
            prop = Proposition(
                article_id=article.id,
                claim_code=p["claim_code"],
                claim_text=p["claim"],
                original_sentence=p["original_sentence"],
                sentence_index=p["sentence_index"],
                claim_type=p["claim_type"],
                verifiability=p["verifiability"],
                entities=p["entities"],
                dates=p["dates"],
                numbers=p["numbers"],
                verification_status="PENDING",
            )
            db.add(prop)
            prop_records.append(prop)
        db.commit()
        for p in prop_records:
            db.refresh(p)

        total_props = len(prop_records)
        report_inputs = []

        for idx, prop in enumerate(prop_records):
            base_progress = 32 + int((idx / max(total_props, 1)) * 58)

            # Stage 3: Query generation
            _update_job(
                db,
                job_id,
                status="running",
                stage="Generating search queries",
                progress=base_progress,
                message=f"Generating search queries for {prop.claim_code} ({idx + 1}/{total_props})...",
            )
            queries = generate_search_queries(prop.claim_text, prop.entities or [], prop.dates or [], prop.numbers or [])

            # Stage 4 & 5: Evidence retrieval + NLI & synthesis
            _update_job(
                db,
                job_id,
                status="running",
                stage="Comparing evidence",
                progress=min(95, base_progress + 5),
                message=f"Retrieving & comparing evidence for {prop.claim_code} ({idx + 1}/{total_props})...",
            )
            final_verdict = _verify_single_proposition(db, prop, queries)

            report_inputs.append(
                {
                    "claim_code": prop.claim_code,
                    "claim": prop.claim_text,
                    "verdict": final_verdict,
                }
            )

        # Stage 6: Final report
        _update_job(db, job_id, status="running", stage="Generating final report", progress=96, message="Compiling final editorial verification report...")
        assessment, summary, findings = compute_article_report(report_inputs)
        article.overall_assessment = assessment
        article.overall_summary = summary
        article.important_findings = findings
        article.analyzed_at = datetime.now(timezone.utc)
        db.commit()

        _update_job(db, job_id, status="completed", stage="completed", progress=100, message="Investigation complete.")
    except PipelineConfigError as exc:
        _update_job(db, job_id, status="failed", stage="failed", progress=0, message="Missing API configuration", error=str(exc))
    except Exception as exc:
        _update_job(db, job_id, status="failed", stage="failed", progress=0, message="Verification pipeline failed", error=str(exc))
    finally:
        db.close()


@router.post("/analyze/{article_id}", response_model=AnalysisJobResponse)
@limiter.limit("10/minute")
def start_analysis(
    request: Request,
    article_id: str,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if not settings.llm_configured or not settings.tavily_configured:
        missing = []
        if not settings.llm_configured:
            missing.append("LLM_API_KEY")
        if not settings.tavily_configured:
            missing.append("TAVILY_API_KEY")
        raise HTTPException(
            status_code=503,
            detail=f"Live verification unavailable: missing {', '.join(missing)} in backend configuration (.env).",
        )

    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    job = AnalysisJob(
        article_id=article.id,
        status="queued",
        stage="Extracting article",
        progress=5,
        message="Queued for verification pipeline...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    thread = threading.Thread(target=_run_pipeline_background, args=(article.id, job.id), daemon=True)
    thread.start()

    return AnalysisJobResponse(
        job_id=job.id,
        article_id=job.article_id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        message=job.message,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/analyze/job/{job_id}", response_model=AnalysisJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return AnalysisJobResponse(
        job_id=job.id,
        article_id=job.article_id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        message=job.message,
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/analyze/stream/{job_id}")
async def stream_job_status(job_id: str):
    async def event_generator():
        while True:
            db = SessionLocal()
            try:
                job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
                if not job:
                    yield f"data: {json.dumps({'error': 'Analysis job not found'})}\n\n"
                    break
                payload = {
                    "job_id": job.id,
                    "article_id": job.article_id,
                    "status": job.status,
                    "stage": job.stage,
                    "progress": job.progress,
                    "message": job.message,
                    "error": job.error,
                }
                yield f"data: {json.dumps(payload)}\n\n"
                if job.status in {"completed", "failed"}:
                    break
            finally:
                db.close()
            await asyncio.sleep(1.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/analysis/{article_id}", response_model=InvestigationReportResponse)
def get_analysis_report(article_id: str, db: Session = Depends(get_db)):
    article = (
        db.query(Article)
        .options(
            joinedload(Article.propositions).joinedload(Proposition.evidence_items),
            joinedload(Article.propositions).joinedload(Proposition.verification),
        )
        .filter(Article.id == article_id)
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    latest_job = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.article_id == article_id)
        .order_by(AnalysisJob.created_at.desc())
        .first()
    )

    prop_responses: List[PropositionResponse] = []
    supported = contradicted = insufficient = conflicting = 0

    for p in article.propositions:
        verdict = p.verification.verdict if p.verification else p.verification_status
        if verdict == "SUPPORTED":
            supported += 1
        elif verdict == "CONTRADICTED":
            contradicted += 1
        elif verdict == "CONFLICTING EVIDENCE":
            conflicting += 1
        else:
            insufficient += 1

        prop_responses.append(
            PropositionResponse(
                id=p.id,
                article_id=p.article_id,
                claim_code=p.claim_code,
                claim_text=p.claim_text,
                original_sentence=p.original_sentence,
                sentence_index=p.sentence_index,
                claim_type=p.claim_type,
                verifiability=p.verifiability,
                entities=p.entities or [],
                dates=p.dates or [],
                numbers=p.numbers or [],
                verification_status=verdict,
                evidence_count=len(p.evidence_items),
                confidence=p.verification.confidence if p.verification else None,
                verification=p.verification,
                evidence_items=p.evidence_items,
            )
        )

    summary = VerificationSummaryStats(
        total_propositions=len(prop_responses),
        supported=supported,
        contradicted=contradicted,
        insufficient_evidence=insufficient,
        conflicting_evidence=conflicting,
    )

    return InvestigationReportResponse(
        article=ArticleResponse.model_validate(article),
        summary=summary,
        propositions=prop_responses,
        latest_job_status=latest_job.status if latest_job else None,
    )


@router.get("/propositions/{proposition_id}", response_model=PropositionResponse)
def get_proposition_detail(proposition_id: str, db: Session = Depends(get_db)):
    prop = (
        db.query(Proposition)
        .options(joinedload(Proposition.evidence_items), joinedload(Proposition.verification))
        .filter(Proposition.id == proposition_id)
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proposition not found.")

    return PropositionResponse(
        id=prop.id,
        article_id=prop.article_id,
        claim_code=prop.claim_code,
        claim_text=prop.claim_text,
        original_sentence=prop.original_sentence,
        sentence_index=prop.sentence_index,
        claim_type=prop.claim_type,
        verifiability=prop.verifiability,
        entities=prop.entities or [],
        dates=prop.dates or [],
        numbers=prop.numbers or [],
        verification_status=prop.verification.verdict if prop.verification else prop.verification_status,
        evidence_count=len(prop.evidence_items),
        confidence=prop.verification.confidence if prop.verification else None,
        verification=prop.verification,
        evidence_items=prop.evidence_items,
    )


class ReverifyPropositionRequest(BaseModel):
    custom_query: Optional[str] = Field(default=None, max_length=300)


@router.post("/propositions/{proposition_id}/reverify", response_model=PropositionResponse)
@limiter.limit("15/minute")
def reverify_proposition(
    request: Request,
    proposition_id: str,
    payload: ReverifyPropositionRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if not settings.tavily_configured:
        raise HTTPException(status_code=503, detail="TAVILY_API_KEY is not configured.")

    prop = db.query(Proposition).filter(Proposition.id == proposition_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proposition not found.")

    custom = (payload.custom_query or "").strip()
    if custom:
        queries = [custom]
    else:
        queries = generate_search_queries(prop.claim_text, prop.entities or [], prop.dates or [], prop.numbers or [])

    _verify_single_proposition(db, prop, queries)

    # Recompute parent article assessment & summary
    article = (
        db.query(Article)
        .options(joinedload(Article.propositions))
        .filter(Article.id == prop.article_id)
        .first()
    )
    if article:
        report_inputs = [
            {"claim_code": p.claim_code, "claim": p.claim_text, "verdict": p.verification_status}
            for p in article.propositions
        ]
        assessment, summary, findings = compute_article_report(report_inputs)
        article.overall_assessment = assessment
        article.overall_summary = summary
        article.important_findings = findings
        article.analyzed_at = datetime.now(timezone.utc)
        db.commit()

    refreshed = (
        db.query(Proposition)
        .options(joinedload(Proposition.evidence_items), joinedload(Proposition.verification))
        .filter(Proposition.id == proposition_id)
        .first()
    )
    assert refreshed is not None
    return PropositionResponse(
        id=refreshed.id,
        article_id=refreshed.article_id,
        claim_code=refreshed.claim_code,
        claim_text=refreshed.claim_text,
        original_sentence=refreshed.original_sentence,
        sentence_index=refreshed.sentence_index,
        claim_type=refreshed.claim_type,
        verifiability=refreshed.verifiability,
        entities=refreshed.entities or [],
        dates=refreshed.dates or [],
        numbers=refreshed.numbers or [],
        verification_status=refreshed.verification.verdict if refreshed.verification else refreshed.verification_status,
        evidence_count=len(refreshed.evidence_items),
        confidence=refreshed.verification.confidence if refreshed.verification else None,
        verification=refreshed.verification,
        evidence_items=refreshed.evidence_items,
    )
