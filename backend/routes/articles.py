from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models.article import Article
from schemas.article_schema import (
    ArticleResponse,
    PasteArticleRequest,
    UpdateArticleTextRequest,
    UrlArticleRequest,
)
from services.document_extractor import (
    ExtractionError,
    compute_counts,
    detect_language,
    extract_from_file,
    fetch_and_extract_url,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/paste", response_model=ArticleResponse)
@limiter.limit("30/minute")
def create_pasted_article(
    request: Request,
    payload: PasteArticleRequest,
    db: Session = Depends(get_db),
):
    text = payload.text.strip()
    words, chars = compute_counts(text)
    if words < 5:
        raise HTTPException(status_code=400, detail="Article text must contain at least 5 words.")

    lang = detect_language(text, payload.language)
    title = (payload.title or "").strip()
    if not title:
        first_line = text.splitlines()[0].strip()
        title = (first_line[:117] + "...") if len(first_line) > 120 else first_line

    article = Article(
        title=title or "Pasted News Article",
        original_text=text,
        input_type="paste",
        language=lang,
        word_count=words,
        char_count=chars,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post("/url", response_model=ArticleResponse)
@limiter.limit("20/minute")
def create_url_article(
    request: Request,
    payload: UrlArticleRequest,
    db: Session = Depends(get_db),
):
    try:
        extracted = fetch_and_extract_url(str(payload.url), payload.language)
    except ExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch article URL: {exc}") from exc

    article = Article(
        title=extracted.title,
        original_text=extracted.text,
        input_type="url",
        original_url=str(payload.url),
        publisher=extracted.publisher,
        publication_date=extracted.publication_date,
        author=extracted.author,
        language=extracted.language,
        word_count=extracted.word_count,
        char_count=extracted.char_count,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post("/upload", response_model=ArticleResponse)
@limiter.limit("20/minute")
async def create_uploaded_article(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    content = await file.read()
    try:
        extracted = extract_from_file(file.filename, content, language)
    except ExtractionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    article = Article(
        title=extracted.title,
        original_text=extracted.text,
        input_type="upload",
        language=extracted.language,
        word_count=extracted.word_count,
        char_count=extracted.char_count,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
def update_article_before_analysis(
    article_id: str,
    payload: UpdateArticleTextRequest,
    db: Session = Depends(get_db),
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    text = payload.text.strip()
    words, chars = compute_counts(text)
    if words < 5:
        raise HTTPException(status_code=400, detail="Article text must contain at least 5 words.")

    if payload.title is not None and payload.title.strip():
        article.title = payload.title.strip()
    article.original_text = text
    article.word_count = words
    article.char_count = chars
    article.language = detect_language(text, payload.language)
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}")
def delete_article(article_id: str, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    db.delete(article)
    db.commit()
    return {"deleted": True, "article_id": article_id}
