import json
from typing import List

from config import get_settings
from services.llm_client import create_json_completion


QUERY_SYSTEM_PROMPT = """You are a research librarian generating search queries to fact-check a factual claim.
For the given proposition, generate 2 to 3 concise, high-precision search queries designed to locate primary sources, official reports, government statistics, research papers, or reputable news coverage.
Preserve key entities, numbers, and dates. Do not include boolean operators that break web search.

Return ONLY valid JSON:
{
  "queries": ["query 1", "query 2", "query 3"]
}"""


def generate_search_queries(
    claim: str,
    entities: List[str],
    dates: List[str],
    numbers: List[str],
) -> List[str]:
    settings = get_settings()
    if settings.llm_configured:
        try:
            prompt = (
                f"Proposition: {claim}\n"
                f"Entities: {', '.join(entities)}\n"
                f"Dates: {', '.join(dates)}\n"
                f"Numbers: {', '.join(numbers)}"
            )
            content = create_json_completion(
                messages=[
                    {"role": "system", "content": QUERY_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                timeout=30.0,
            )
            data = json.loads(content)
            queries = [str(q).strip() for q in data.get("queries", []) if str(q).strip()]
            if queries:
                return queries[:3]
        except Exception:
            pass

    # Deterministic fallback if LLM query generation fails transiently
    base = claim[:180].strip()
    entity_str = " ".join(entities[:3] + dates[:2]).strip()
    queries = [base]
    if entity_str:
        queries.append(f"{entity_str} official report statistics")
    if numbers:
        queries.append(f"{' '.join(entities[:2])} {numbers[0]} verification".strip())
    return queries[:3]
