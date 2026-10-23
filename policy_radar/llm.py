"""OpenAI calls: structured extraction of a document into criteria, and embeddings.

The Extracted* models are what the model fills in; pipelines.py turns them into domain
models by adding ids. They have no defaults because OpenAI strict structured outputs
require every field to be present (nullable where optional).
"""

import base64
from datetime import date

from openai import AsyncOpenAI
from pydantic import BaseModel

from policy_radar import parsing, storage
from policy_radar.config import settings
from policy_radar.enums import (
    STRENGTH_VALUES,
    CodeSystem,
    CoverageEffect,
    PolicyDocumentType,
    StrengthSystem,
)
from policy_radar.models import SourceDocument

MAX_TEXT_CHARS = 400_000  # keeps one document inside the model's context window

client = AsyncOpenAI(api_key=settings.openai_api_key)

_CRITERION_RULES = """A criterion is one self-contained, testable condition: who it applies to, \
what service or drug, and what is recommended, required, covered or excluded. Keep the source \
wording as closely as possible and include enough context (population, age, frequency, setting) \
for it to stand alone. Emit criteria in document order. Never invent a criterion that the \
text does not state. concept_words are 3-8 clinical terms a reviewer would search for."""

_STRENGTH_SCALES = "; ".join(
    f"{system.value}: {', '.join(m.value for m in values)}"
    for system, values in STRENGTH_VALUES.items()
)

GUIDELINE_PROMPT = f"""You atomize a clinical guideline, drug label, coverage determination or \
regulation into criteria. {_CRITERION_RULES} published is the document's own publication or \
effective date, or null if the text states none. strength_system is the grading scheme of \
the document's overall recommendation and strength is its grade in that scheme, using only \
these pairs: {_STRENGTH_SCALES}. Set both or neither; if the scheme is not listed, or the \
document has no single overall grade, set both to null. If the document holds no testable \
criteria, return an empty criteria list."""

POLICY_PROMPT = f"""You parse a payer Clinical Policy Bulletin (CPB) into criteria and codes. \
{_CRITERION_RULES} Include medical-necessity, experimental/investigational and exclusion \
criteria. policy_number is the bulletin number as printed (e.g. "0584"). coverage_effect is \
the bulletin's predominant determination. codes are only the codes the bulletin lists."""


class ExtractedCriterion(BaseModel):
    text: str
    concept_words: list[str]


class ExtractedCode(BaseModel):
    system: CodeSystem
    value: str


class ExtractedGuideline(BaseModel):
    title: str
    published: date | None
    version: str | None
    strength: str | None
    strength_system: StrengthSystem | None
    criteria: list[ExtractedCriterion]


class ExtractedPolicy(BaseModel):
    policy_number: str
    doc_type: PolicyDocumentType
    title: str
    coverage_effect: CoverageEffect
    effective_date: date
    last_reviewed: date | None
    codes: list[ExtractedCode]
    criteria: list[ExtractedCriterion]


def _content(doc: SourceDocument) -> dict:
    """The document as one Responses-API input part: PDFs as files, everything else as text."""
    raw = storage.get(doc.storage_uri)
    text = parsing.extract_text(doc.media_type, raw)
    if text is None:  # PDF: let the model read the pages themselves
        data = base64.b64encode(raw).decode()
        return {
            "type": "input_file",
            "filename": doc.storage_uri.rsplit("/", 1)[-1],
            "file_data": f"data:application/pdf;base64,{data}",
        }
    return {"type": "input_text", "text": text[:MAX_TEXT_CHARS]}


async def extract[M: BaseModel](schema: type[M], instructions: str, doc: SourceDocument) -> M:
    """Ask the model to fill ``schema`` from ``doc``."""
    response = await client.responses.parse(
        model=settings.openai_model,
        instructions=instructions,
        input=[{"role": "user", "content": [_content(doc)]}],
        text_format=schema,
    )
    if response.output_parsed is None:
        raise ValueError(f"model returned no parsable output for {doc.document_id}")
    return response.output_parsed


async def embed(texts: list[str]) -> list[list[float]]:
    """One embedding per text, in order. Empty input makes no API call."""
    if not texts:
        return []
    response = await client.embeddings.create(model=settings.openai_embedding_model, input=texts)
    return [d.embedding for d in response.data]
