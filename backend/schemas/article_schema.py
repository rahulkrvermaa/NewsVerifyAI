from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class PasteArticleRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    text: str = Field(..., min_length=20, max_length=200000)
    language: Optional[str] = Field(default="auto", max_length=32)


class UrlArticleRequest(BaseModel):
    url: HttpUrl
    language: Optional[str] = Field(default="auto", max_length=32)


class UpdateArticleTextRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    text: str = Field(..., min_length=20, max_length=200000)
    language: Optional[str] = Field(default="auto", max_length=32)


class ArticleResponse(BaseModel):
    id: str
    title: str
    original_text: str
    input_type: str
    original_url: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    author: Optional[str] = None
    language: str
    word_count: int
    char_count: int
    overall_assessment: Optional[str] = None
    overall_summary: Optional[str] = None
    important_findings: Optional[List[str]] = None
    created_at: datetime
    analyzed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnalysisJobResponse(BaseModel):
    job_id: str
    article_id: str
    status: str
    stage: str
    progress: int
    message: str
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
