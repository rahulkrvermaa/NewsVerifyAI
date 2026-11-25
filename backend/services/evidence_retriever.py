from dataclasses import dataclass
from functools import lru_cache
import re
from typing import List

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

from config import get_settings
from services.search_service import RetrievedSource

settings = get_settings()


@dataclass
class RankedEvidence:
    source: RetrievedSource
    relevance_score: float
    highlighted_excerpt: str


@lru_cache
def _get_embedder() -> SentenceTransformer:
    return SentenceTransformer(settings.EMBEDDING_MODEL)


@lru_cache
def _get_cross_encoder() -> CrossEncoder:
    return CrossEncoder(settings.CROSS_ENCODER_MODEL)


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\b\w+\b", text.lower())


def _select_best_excerpt(claim: str, evidence_text: str) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", evidence_text) if len(s.strip()) > 20]
    if not sentences:
        return evidence_text[:320].strip()
    if len(sentences) == 1:
        return sentences[0]

    claim_tokens = set(_tokenize(claim))
    best_sent = sentences[0]
    best_overlap = -1.0
    for sent in sentences:
        sent_tokens = set(_tokenize(sent))
        if not sent_tokens:
            continue
        overlap = len(claim_tokens & sent_tokens) / (len(claim_tokens) + 1e-6)
        if overlap > best_overlap:
            best_overlap = overlap
            best_sent = sent
    return best_sent


def rank_evidence_hybrid(
    claim: str,
    sources: List[RetrievedSource],
    top_k: int = 6,
) -> List[RankedEvidence]:
    """
    Hybrid evidence retrieval combining:
    1. Dense semantic similarity via SentenceTransformers + FAISS (IndexFlatIP)
    2. Lexical keyword retrieval via BM25Okapi
    3. Cross-encoder reranking on the merged candidate pool
    Note: Relevance score measures topical alignment, NOT truth.
    """
    if not sources:
        return []

    docs = [f"{s.source_title}. {s.evidence_text}" for s in sources]

    # 1. Dense retrieval with FAISS
    embedder = _get_embedder()
    doc_embeddings = embedder.encode(docs, normalize_embeddings=True, convert_to_numpy=True).astype("float32")
    claim_embedding = embedder.encode([claim], normalize_embeddings=True, convert_to_numpy=True).astype("float32")

    dim = doc_embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(doc_embeddings)
    dense_scores_raw, _ = index.search(claim_embedding, len(docs))
    # Map index -> cosine similarity in [0, 1]
    dense_map = {}
    for pos, score in enumerate(dense_scores_raw[0]):
        dense_map[pos] = max(0.0, min(1.0, float((score + 1.0) / 2.0)))

    # 2. Sparse retrieval with BM25
    tokenized_docs = [_tokenize(d) for d in docs]
    bm25 = BM25Okapi(tokenized_docs)
    bm25_raw = bm25.get_scores(_tokenize(claim))
    max_bm25 = float(np.max(bm25_raw)) if len(bm25_raw) > 0 and np.max(bm25_raw) > 0 else 1.0
    bm25_norm = [float(s / max_bm25) for s in bm25_raw]

    # Combine dense + sparse to pick top candidates for cross-encoder reranking
    hybrid_candidates = []
    for idx, src in enumerate(sources):
        hybrid_score = 0.55 * dense_map.get(idx, 0.0) + 0.30 * bm25_norm[idx] + 0.15 * min(1.0, src.search_score)
        hybrid_candidates.append((idx, hybrid_score))

    hybrid_candidates.sort(key=lambda x: x[1], reverse=True)
    shortlist = hybrid_candidates[: min(10, len(hybrid_candidates))]

    # 3. Cross-encoder reranking
    try:
        cross_encoder = _get_cross_encoder()
        pairs = [(claim, docs[idx]) for idx, _ in shortlist]
        ce_scores = cross_encoder.predict(pairs)
        # Sigmoid normalize cross-encoder logits to [0, 1]
        ce_probs = [float(1.0 / (1.0 + np.exp(-float(s)))) for s in ce_scores]
    except Exception:
        ce_probs = [score for _, score in shortlist]

    ranked: List[RankedEvidence] = []
    for (idx, h_score), ce_prob in zip(shortlist, ce_probs):
        src = sources[idx]
        final_relevance = round(0.65 * ce_prob + 0.35 * h_score, 4)
        ranked.append(
            RankedEvidence(
                source=src,
                relevance_score=final_relevance,
                highlighted_excerpt=_select_best_excerpt(claim, src.evidence_text),
            )
        )

    ranked.sort(key=lambda r: r.relevance_score, reverse=True)
    return ranked[:top_k]
