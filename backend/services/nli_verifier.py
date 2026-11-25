from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List

from transformers import pipeline

from config import get_settings

settings = get_settings()


@dataclass
class NLIResult:
    label: str  # entailment | contradiction | neutral
    score: float
    stance: str  # supporting | contradicting | neutral


@lru_cache
def _get_nli_pipeline():
    return pipeline(
        "text-classification",
        model=settings.NLI_MODEL,
        top_k=None,
        truncation=True,
    )


def _parse_nli_outputs(outputs: List[Dict]) -> NLIResult:
    scores = {item["label"].lower(): float(item["score"]) for item in outputs}
    entailment = scores.get("entailment", 0.0)
    contradiction = scores.get("contradiction", 0.0)
    neutral = scores.get("neutral", 0.0)

    if contradiction >= entailment and contradiction >= neutral and contradiction >= 0.45:
        return NLIResult(label="contradiction", score=round(contradiction, 4), stance="contradicting")
    if entailment >= contradiction and entailment >= neutral and entailment >= 0.45:
        return NLIResult(label="entailment", score=round(entailment, 4), stance="supporting")
    return NLIResult(label="neutral", score=round(max(neutral, entailment, contradiction), 4), stance="neutral")


def verify_evidence_nli_batch(premises: List[str], hypothesis: str) -> List[NLIResult]:
    """
    Compare a batch of retrieved evidence premises against one proposition hypothesis
    in a single NLI forward pass.
    """
    if not premises:
        return []

    nli = _get_nli_pipeline()
    pairs = [{"text": p[:1500], "text_pair": hypothesis[:500]} for p in premises]
    raw_outputs = nli(pairs, batch_size=len(pairs))
    return [_parse_nli_outputs(item) for item in raw_outputs]


def verify_evidence_nli(premise: str, hypothesis: str) -> NLIResult:
    """
    Compare a single retrieved evidence premise against the proposition hypothesis
    using an NLI model (e.g. facebook/bart-large-mnli).
    """
    return verify_evidence_nli_batch([premise], hypothesis)[0]
