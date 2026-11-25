from io import BytesIO
from pathlib import Path
import sys

from docx import Document
from fastapi.testclient import TestClient
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import Base, engine
from main import app
from services.document_extractor import ExtractionError, validate_public_url
from services.preprocessing import preprocess_text
from services.report_generator import compute_article_report


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_health_and_config_status():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    cfg = client.get("/api/config/status")
    assert cfg.status_code == 200
    body = cfg.json()
    assert "llm_configured" in body
    assert "tavily_configured" in body
    assert "LLM_API_KEY" not in body
    assert "TAVILY_API_KEY" not in body


def test_paste_update_history_and_delete():
    res = client.post(
        "/api/articles/paste",
        json={
            "title": "Central Bank Inflation Update",
            "text": "The central bank reported that annual inflation fell to 3.1 percent in October 2025 according to official quarterly statistics.",
            "language": "auto",
        },
    )
    assert res.status_code == 200
    article = res.json()
    assert article["title"] == "Central Bank Inflation Update"
    assert article["input_type"] == "paste"
    assert article["word_count"] >= 15

    upd = client.put(
        f"/api/articles/{article['id']}",
        json={
            "title": "Updated Inflation Report",
            "text": "The central bank reported that annual inflation fell to 3.1 percent in October 2025. Analysts noted stable core prices.",
            "language": "en",
        },
    )
    assert upd.status_code == 200
    assert upd.json()["title"] == "Updated Inflation Report"

    hist = client.get("/api/history")
    assert hist.status_code == 200
    assert len(hist.json()) == 1

    dele = client.delete(f"/api/articles/{article['id']}")
    assert dele.status_code == 200
    assert dele.json()["deleted"] is True

    hist_after = client.get("/api/history")
    assert hist_after.json() == []


def test_upload_txt_docx_and_reject_invalid():
    txt_res = client.post(
        "/api/articles/upload",
        files={"file": ("sample_report.txt", b"Global renewable capacity grew by 14 percent in 2024 according to energy agency data.", "text/plain")},
        data={"language": "auto"},
    )
    assert txt_res.status_code == 200
    assert txt_res.json()["input_type"] == "upload"

    buf = BytesIO()
    doc = Document()
    doc.add_paragraph("The European Space Agency launched a new climate observation satellite in 2025.")
    doc.save(buf)
    buf.seek(0)

    docx_res = client.post(
        "/api/articles/upload",
        files={"file": ("esa_brief.docx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"language": "en"},
    )
    assert docx_res.status_code == 200
    assert "European Space Agency" in docx_res.json()["original_text"]

    bad_res = client.post(
        "/api/articles/upload",
        files={"file": ("malware.exe", b"MZ...", "application/octet-stream")},
        data={"language": "auto"},
    )
    assert bad_res.status_code == 400


def test_ssrf_protection():
    for blocked in [
        "http://127.0.0.1/admin",
        "http://localhost:8000/api/health",
        "http://169.254.169.254/latest/meta-data/",
        "ftp://example.com/file.txt",
        "http://10.0.0.1/internal",
    ]:
        with pytest.raises(ExtractionError):
            validate_public_url(blocked)


def test_preprocessing_and_report_generator():
    prep = preprocess_text("On January 15, 2025, Reuters reported that Acme Corp raised $50 million in Geneva.")
    assert len(prep.sentences) >= 1
    assert "Acme Corp" in prep.cleaned_text

    assessment, summary, findings = compute_article_report(
        [
            {"claim_code": "P001", "claim": "Claim 1", "verdict": "SUPPORTED"},
            {"claim_code": "P002", "claim": "Claim 2", "verdict": "CONTRADICTED"},
        ]
    )
    assert assessment == "Mixed evidence"
    assert "2 extracted factual propositions" in summary
    assert len(findings) == 2


def test_dashboard_empty_state():
    dash = client.get("/api/dashboard")
    assert dash.status_code == 200
    data = dash.json()
    assert data["articles_analyzed"] == 0
    assert data["propositions_extracted"] == 0
    assert data["recent_investigations"] == []
