from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urlparse

from tavily import TavilyClient

from config import get_settings
from services.proposition_extractor import PipelineConfigError


@dataclass
class RetrievedSource:
    source_title: str
    source_url: str
    publisher: str
    publication_date: Optional[str]
    evidence_text: str
    source_category: str
    search_score: float


OFFICIAL_SUFFIXES = (".gov", ".gov.uk", ".gov.in", ".europa.eu", ".un.org", ".who.int", ".imf.org", ".worldbank.org", ".oecd.org")
RESEARCH_DOMAINS = ("arxiv.org", "nature.com", "science.org", "thelancet.com", "nejm.org", "pubmed.ncbi.nlm.nih.gov", "scholar.google", "jstor.org", "springer.com", "wiley.com", ".edu")
NEWS_DOMAINS = ("reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com", "wsj.com", "ft.com", "bloomberg.com", "theguardian.com", "washingtonpost.com", "npr.org", "economist.com", "aljazeera.com")


def categorize_source(url: str) -> str:
    host = urlparse(url).netloc.lower().replace("www.", "")
    if any(host.endswith(s) or s in host for s in OFFICIAL_SUFFIXES):
        return "Official sources"
    if any(host.endswith(d) or d in host for d in RESEARCH_DOMAINS):
        return "Research publications"
    if any(host.endswith(d) or d in host for d in NEWS_DOMAINS):
        return "News organizations"
    return "Other sources"


def extract_publisher(url: str) -> str:
    host = urlparse(url).netloc.lower().replace("www.", "")
    return host or "Unknown Publisher"


def search_evidence_tavily(queries: List[str], max_results_per_query: int = 4) -> List[RetrievedSource]:
    settings = get_settings()
    if not settings.tavily_configured:
        raise PipelineConfigError(
            "TAVILY_API_KEY is not configured. Add TAVILY_API_KEY to your .env file to retrieve external evidence."
        )

    client = TavilyClient(api_key=settings.TAVILY_API_KEY)
    seen_urls: set[str] = set()
    results: List[RetrievedSource] = []

    for query in queries[:3]:
        try:
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results_per_query,
                include_raw_content=False,
            )
        except Exception:
            continue

        for item in response.get("results", []):
            url = (item.get("url") or "").strip()
            content = (item.get("content") or "").strip()
            title = (item.get("title") or "").strip() or "Untitled Source"
            if not url or not content or url in seen_urls:
                continue
            seen_urls.add(url)

            results.append(
                RetrievedSource(
                    source_title=title[:500],
                    source_url=url[:2048],
                    publisher=extract_publisher(url),
                    publication_date=item.get("published_date"),
                    evidence_text=content,
                    source_category=categorize_source(url),
                    search_score=float(item.get("score") or 0.5),
                )
            )

    return results
