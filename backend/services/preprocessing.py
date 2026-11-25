from dataclasses import dataclass, field
from functools import lru_cache
import re
from typing import List

import spacy

from config import get_settings

settings = get_settings()


@dataclass
class PreprocessedSentence:
    index: int
    text: str
    start_char: int
    end_char: int
    entities: List[str] = field(default_factory=list)
    dates: List[str] = field(default_factory=list)
    numbers: List[str] = field(default_factory=list)


@dataclass
class PreprocessedArticle:
    cleaned_text: str
    sentences: List[PreprocessedSentence]
    all_entities: List[str]
    all_dates: List[str]
    all_numbers: List[str]


@lru_cache
def _load_spacy_nlp():
    try:
        return spacy.load(settings.SPACY_MODEL)
    except OSError:
        nlp = spacy.blank("en")
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return nlp


def clean_article_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def preprocess_text(raw_text: str) -> PreprocessedArticle:
    cleaned = clean_article_text(raw_text)
    nlp = _load_spacy_nlp()
    doc = nlp(cleaned[:100000])  # guard against extreme single-doc memory spikes

    sentences: List[PreprocessedSentence] = []
    all_entities: set[str] = set()
    all_dates: set[str] = set()
    all_numbers: set[str] = set()

    for idx, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        if not sent_text:
            continue

        ents: List[str] = []
        dates: List[str] = []
        nums: List[str] = []

        for ent in sent.ents:
            val = ent.text.strip()
            if not val:
                continue
            if ent.label_ in {"DATE", "TIME"}:
                if val not in dates:
                    dates.append(val)
                all_dates.add(val)
            elif ent.label_ in {"CARDINAL", "PERCENT", "MONEY", "QUANTITY", "ORDINAL"}:
                if val not in nums:
                    nums.append(val)
                all_numbers.add(val)
            elif ent.label_ in {"PERSON", "ORG", "GPE", "LOC", "NORP", "FAC", "EVENT", "LAW"}:
                if val not in ents:
                    ents.append(val)
                all_entities.add(val)

        sentences.append(
            PreprocessedSentence(
                index=idx,
                text=sent_text,
                start_char=sent.start_char,
                end_char=sent.end_char,
                entities=ents,
                dates=dates,
                numbers=nums,
            )
        )

    return PreprocessedArticle(
        cleaned_text=cleaned,
        sentences=sentences,
        all_entities=sorted(all_entities),
        all_dates=sorted(all_dates),
        all_numbers=sorted(all_numbers),
    )
