from dataclasses import dataclass
import ipaddress
import json
import re
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
import fitz  # PyMuPDF
from docx import Document
import httpx
from langdetect import DetectorFactory, LangDetectException, detect
import trafilatura

from config import get_settings

DetectorFactory.seed = 0
settings = get_settings()

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "metadata.google.internal"}


class ExtractionError(Exception):
    """Raised when article fetching or file extraction fails validation or parsing."""


@dataclass
class ExtractedArticle:
    title: str
    text: str
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    author: Optional[str] = None
    language: str = "en"
    word_count: int = 0
    char_count: int = 0


def detect_language(text: str, requested: Optional[str] = "auto") -> str:
    if requested and requested.lower() != "auto":
        return requested.lower()
    sample = text.strip()[:2000]
    if len(sample) < 20:
        return "en"
    try:
        return detect(sample)
    except LangDetectException:
        return "en"


def compute_counts(text: str) -> tuple[int, int]:
    cleaned = text.strip()
    words = len(re.findall(r"\b\w+\b", cleaned))
    return words, len(cleaned)


def _is_ip_public(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return False
    return True


def validate_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ExtractionError("Only HTTP and HTTPS URLs are supported.")
    if not parsed.netloc or not parsed.hostname:
        raise ExtractionError("Invalid URL: missing hostname.")
    if parsed.username or parsed.password:
        raise ExtractionError("URLs containing credentials are not permitted.")

    hostname = parsed.hostname.lower()
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise ExtractionError("Access to local or internal hostnames is blocked.")

    # Direct IP literal check
    try:
        if not _is_ip_public(hostname):
            raise ExtractionError("Access to private or reserved IP addresses is blocked.")
    except ValueError:
        pass

    # Resolve DNS and verify all returned IPs are public
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addr_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ExtractionError(f"Could not resolve hostname '{hostname}'.") from exc

    if not addr_info:
        raise ExtractionError(f"No DNS records found for '{hostname}'.")

    for info in addr_info:
        sockaddr = info[4]
        if not sockaddr:
            continue
        ip_str = sockaddr[0].split("%")[0]
        if not _is_ip_public(ip_str):
            raise ExtractionError("Target URL resolves to a private or non-routable IP address.")

    return raw_url.strip()


def _fallback_tavily_extract(url: str, requested_language: Optional[str] = "auto") -> Optional[ExtractedArticle]:
    """Use Tavily Extract when a public news site blocks direct HTTP requests (401/403/429)."""
    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        resp = client.extract(urls=[url], format="text")
        results = resp.get("results") or []
        if not results:
            return None
        raw_content = (results[0].get("raw_content") or "").strip()
        if len(raw_content) < 40:
            return None

        cleaned = re.sub(r"\n{3,}", "\n\n", raw_content).strip()
        lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
        title = (lines[0][:200] if lines else "") or urlparse(url).netloc or "Extracted Web Article"
        publisher = urlparse(url).netloc.replace("www.", "") or None
        words, chars = compute_counts(cleaned)
        return ExtractedArticle(
            title=title,
            text=cleaned,
            publisher=publisher,
            language=detect_language(cleaned, requested_language),
            word_count=words,
            char_count=chars,
        )
    except Exception:
        return None


def fetch_and_extract_url(url: str, requested_language: Optional[str] = "auto") -> ExtractedArticle:
    current_url = validate_public_url(url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    max_redirects = 5
    response_bytes = b""
    final_url = current_url
    content_type = ""

    with httpx.Client(
        timeout=httpx.Timeout(settings.REQUEST_TIMEOUT_SECONDS),
        follow_redirects=False,
        headers=headers,
    ) as client:
        for _ in range(max_redirects + 1):
            validate_public_url(current_url)
            with client.stream("GET", current_url) as resp:
                if resp.status_code in {301, 302, 303, 307, 308}:
                    location = resp.headers.get("location")
                    if not location:
                        raise ExtractionError("Redirect response missing Location header.")
                    current_url = urljoin(current_url, location)
                    continue

                if resp.status_code in {401, 403, 429} and settings.tavily_configured:
                    fallback = _fallback_tavily_extract(current_url, requested_language)
                    if fallback is not None:
                        return fallback

                if resp.status_code >= 400:
                    raise ExtractionError(f"Failed to fetch URL (HTTP {resp.status_code}).")

                content_type = (resp.headers.get("content-type") or "").lower()
                if not any(ct in content_type for ct in ("text/html", "application/xhtml+xml", "text/plain")):
                    raise ExtractionError(f"Unsupported content type: {content_type or 'unknown'}.")

                content_length = resp.headers.get("content-length")
                if content_length and content_length.isdigit() and int(content_length) > settings.MAX_URL_BYTES:
                    raise ExtractionError("Remote page exceeds maximum allowed size.")

                chunks = []
                total = 0
                for chunk in resp.iter_bytes(chunk_size=16384):
                    total += len(chunk)
                    if total > settings.MAX_URL_BYTES:
                        raise ExtractionError("Remote page exceeds maximum allowed size.")
                    chunks.append(chunk)
                response_bytes = b"".join(chunks)
                final_url = str(resp.url)
                break
        else:
            raise ExtractionError("Too many redirects while fetching URL.")

    html = response_bytes.decode("utf-8", errors="replace")
    if "text/plain" in content_type:
        cleaned_text = re.sub(r"\n{3,}", "\n\n", html).strip()
        if len(cleaned_text) < 40:
            raise ExtractionError("Extracted plain text is too short to analyze.")
        words, chars = compute_counts(cleaned_text)
        return ExtractedArticle(
            title=urlparse(final_url).netloc or "Fetched Text Article",
            text=cleaned_text,
            publisher=urlparse(final_url).netloc,
            language=detect_language(cleaned_text, requested_language),
            word_count=words,
            char_count=chars,
        )

    # Primary extraction via trafilatura with JSON metadata
    extracted_json = trafilatura.extract(
        html,
        url=final_url,
        output_format="json",
        include_comments=False,
        include_tables=False,
        favor_precision=True,
    )

    title = ""
    text = ""
    publisher = None
    publication_date = None
    author = None

    if extracted_json:
        try:
            data = json.loads(extracted_json)
            title = (data.get("title") or "").strip()
            text = (data.get("text") or "").strip()
            publisher = (data.get("sitename") or "").strip() or None
            publication_date = (data.get("date") or "").strip() or None
            author = (data.get("author") or "").strip() or None
        except json.JSONDecodeError:
            pass

    # BeautifulSoup fallback / metadata enrichment
    soup = BeautifulSoup(html, "html.parser")
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = og_title["content"].strip()
        elif soup.title and soup.title.string:
            title = soup.title.string.strip()

    if not publisher:
        og_site = soup.find("meta", property="og:site_name")
        if og_site and og_site.get("content"):
            publisher = og_site["content"].strip()
        else:
            publisher = urlparse(final_url).netloc.replace("www.", "")

    if not publication_date:
        pub_meta = soup.find("meta", property="article:published_time") or soup.find("meta", attrs={"name": "date"})
        if pub_meta and pub_meta.get("content"):
            publication_date = pub_meta["content"].strip()

    if not author:
        author_meta = soup.find("meta", attrs={"name": "author"})
        if author_meta and author_meta.get("content"):
            author = author_meta["content"].strip()

    if len(text) < 80:
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form"]):
            tag.decompose()
        article_node = soup.find("article") or soup.find("main") or soup.body
        if article_node:
            paragraphs = [p.get_text(" ", strip=True) for p in article_node.find_all(["p", "h2", "h3"])]
            text = "\n\n".join(p for p in paragraphs if len(p) > 25)

    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 40:
        raise ExtractionError(
            "Could not extract meaningful article content from this URL. The page may be paywalled, JS-only, or empty."
        )

    words, chars = compute_counts(text)
    return ExtractedArticle(
        title=title or "Extracted Web Article",
        text=text,
        publisher=publisher,
        publication_date=publication_date,
        author=author,
        language=detect_language(text, requested_language),
        word_count=words,
        char_count=chars,
    )


def extract_from_file(filename: str, content: bytes, requested_language: Optional[str] = "auto") -> ExtractedArticle:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ExtractionError("Unsupported file type. Only .txt, .pdf, and .docx are accepted.")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise ExtractionError(f"File exceeds maximum size of {settings.MAX_UPLOAD_MB} MB.")

    if len(content) == 0:
        raise ExtractionError("Uploaded file is empty.")

    text = ""
    if ext == ".txt":
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("utf-8", errors="replace")
    elif ext == ".pdf":
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:
                pages = [page.get_text("text") for page in doc]
            text = "\n\n".join(p.strip() for p in pages if p.strip())
        except Exception as exc:
            raise ExtractionError(f"Failed to parse PDF document: {exc}") from exc
    elif ext == ".docx":
        try:
            from io import BytesIO

            doc = Document(BytesIO(content))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            text = "\n\n".join(paragraphs)
        except Exception as exc:
            raise ExtractionError(f"Failed to parse DOCX document: {exc}") from exc

    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 20:
        raise ExtractionError("Extracted document text is too short or empty.")

    base_title = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip()
    words, chars = compute_counts(text)
    return ExtractedArticle(
        title=base_title or "Uploaded Document",
        text=text,
        language=detect_language(text, requested_language),
        word_count=words,
        char_count=chars,
    )
