# NewsVerify AI

**Separate claims from facts.**

NewsVerify AI is an AI-powered news authenticity and proposition verification platform built for investigative journalists, researchers, students, and fact-checkers. Rather than assigning opaque truth scores or labeling an entire article fake from a single disputed detail, it decomposes articles into atomic factual propositions, retrieves external evidence from primary sources, and synthesizes evidence-grounded verdicts.

> *Core philosophy: Every claim needs evidence. Every verdict needs a source.*

---

## Key Features

- **Three Article Input Modes**:
  - **Paste Article**: Editorial text editor with clipboard paste, word/character counters, and language selection (`auto`, `en`, `es`, `fr`, `de`).
  - **Article URL**: Extracts main article content, headline, publisher, author, and publication date via `trafilatura` and `BeautifulSoup`, with SSRF protection (blocking private/loopback/reserved IPs and unsafe redirects) and a Tavily Extract fallback for sites that block direct requests.
  - **Upload File**: Drag-and-drop or browse `.txt`, `.pdf` (`PyMuPDF`), and `.docx` (`python-docx`) files with size and type validation.
  - **Pre-Analysis Review**: Inspect and edit the extracted headline and body text before triggering the AI pipeline.
- **Six-Stage Verification Pipeline**:
  1. **Text Preprocessing & NER**: `spaCy` (`en_core_web_sm`) sentence segmentation and entity/date/number extraction.
  2. **Proposition Extraction**: Structured JSON extraction of atomic, verifiable factual claims via OpenAI-compatible LLMs (e.g., Gemini `gemini-3.5-flash-lite` or OpenAI `gpt-4o-mini`) with prompt-injection isolation and automatic `429`/`503` retry + model fallback.
  3. **Query Generation**: 2–3 targeted search queries per proposition preserving entities, dates, and figures.
  4. **External Evidence Retrieval**: Tavily Search API integration categorizing sources into *Official sources*, *Research publications*, *News organizations*, and *Other sources*.
  5. **Hybrid Evidence Grounding**: Dense semantic retrieval (`SentenceTransformers` + `FAISS`), lexical scoring (`BM25Okapi`), and `CrossEncoder` reranking (`ms-marco-MiniLM-L-6-v2`).
  6. **NLI & Evidence-Grounded Synthesis**: Batched Natural Language Inference (`facebook/bart-large-mnli`) followed by LLM verdict synthesis (`SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT EVIDENCE`, `CONFLICTING EVIDENCE`).
- **Editorial Investigation Report**:
  - Article overview with overall assessment (*Mostly supported*, *Contains disputed claims*, *Mixed evidence*, *Requires further verification*), summary, and key findings.
  - Collapsible **Source Article Context** with inline highlighting and auto-scroll to the active proposition's original sentence.
  - **Proposition Explorer** with verdict filter pills, keyword search, and `J`/`K` (`↑`/`↓`) keyboard navigation.
  - **Single-Claim Re-Verification**: Re-run evidence retrieval and NLI for an individual proposition with an optional custom search query.
  - **Exports**: **Export PDF**, **Export JSON**, **Copy Markdown**, and print-ready `@media print` formatting.
- **Dashboard, History & Evidence Library**:
  - **Overview**: Real SQLite metrics, Recharts verification distribution chart, recent investigations, latest activity, and recently retrieved sources.
  - **Investigation History**: Search, filter by assessment, sort by date, open, or delete investigations.
  - **Sources & Evidence**: Filterable repository of retrieved sources and highlighted excerpts linked back to their propositions.

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide Icons, jsPDF
- **Backend**: Python 3.13, FastAPI, Pydantic, SQLAlchemy, SQLite, SlowAPI
- **AI / NLP / Retrieval**: OpenAI Python SDK (OpenAI & Gemini OpenAI-compatible endpoints), spaCy, Tavily Search API, Sentence Transformers, FAISS, BM25 (`rank-bm25`), HuggingFace Transformers (`facebook/bart-large-mnli`)
- **Document Extraction**: `trafilatura`, `beautifulsoup4`, `httpx`, `pymupdf`, `python-docx`, `langdetect`

---

## Project Structure

```text
├── .env.example
├── .gitignore
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── requirements.txt
│   ├── models/          # SQLAlchemy ORM models (Article, AnalysisJob, Proposition, Evidence, Verification)
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routes/          # FastAPI routers (articles, analysis, history, evidence)
│   ├── services/        # Extraction, preprocessing, retrieval, NLI, LLM synthesis, reporting
│   └── tests/           # Pytest suite
└── frontend/
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── components/  # Layout, Toast, VerdictBadge
        ├── hooks/       # useTheme
        ├── pages/       # Overview, NewInvestigation, Results, History, EvidenceLibrary, About, Settings
        ├── services/    # Typed API client
        └── types/       # TypeScript interfaces
```

---

## Getting Started

### 1. Configure Environment Variables

Copy `.env.example` to `.env` in the project root and add your credentials:

```env
LLM_API_KEY=your_llm_api_key
TAVILY_API_KEY=your_tavily_api_key
LLM_MODEL=gemini-3.5-flash-lite
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
DATABASE_URL=sqlite:///./newsverify.db
```

> **Note**: API keys are used strictly on the backend and are never exposed to the frontend. If credentials are missing, the UI displays a configuration notice and blocks live verification rather than faking results.

### 2. Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe -m spacy download en_core_web_sm
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

> **Windows Note**: Running `python -m uvicorn` avoids Windows Smart App Control warnings that can occur on unsigned `.exe` script wrappers.

### 3. Frontend Setup

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## Running Tests

### Backend (`pytest`)

```powershell
.\backend\.venv\Scripts\pytest.exe backend/tests/test_api.py -v
```

### Frontend (`tsc` & `vite build`)

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

---

## Security & Editorial Safeguards

- **Untrusted Input Isolation**: Submitted articles and retrieved web excerpts are passed as delimited data; system prompts instruct the LLM never to follow embedded instructions.
- **SSRF Protection**: URL fetching validates schemes (`http`/`https`), blocks local/internal hostnames and private/loopback/link-local/reserved IPs across redirects, and enforces response size and timeout limits.
- **No Fabricated Evidence**: Verdicts are synthesized strictly from retrieved sources and NLI signals; missing or weak evidence returns `INSUFFICIENT EVIDENCE`.
- **Rate Limiting**: API endpoints are rate-limited with `slowapi`.
