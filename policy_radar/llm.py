"""Bedrock calls: structured extraction of a document into criteria, and embeddings.

The Extracted* models are what the model fills in; pipelines.py turns them into domain
models by adding ids. They have no defaults because structured outputs require every
field to be present (nullable where optional).
"""

import asyncio
import base64
import json
from datetime import date
import os

from dotenv import load_dotenv
import boto3
import instructor
from pydantic import BaseModel, Field

from policy_radar import parser, storage
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

load_dotenv()  # Forces system to read the .env file

bedrock_client = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION_NAME", "us-east-1")
)

client = instructor.from_bedrock(bedrock_client, mode=instructor.Mode.BEDROCK_JSON)

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
the bulletin's predominant determination. codes are only the codes the bulletin lists. \
effective_date is the policy's own effective date, or null if the text states none."""


class ExtractedCriterion(BaseModel):
    text: str
    concept_words: list[str]

class ExtractedCode(BaseModel):
    system: str = Field(description="e.g. cpt, hcpcs, icd10cm")
    value: str

class ExtractedGuideline(BaseModel):
    title: str
    published: str | None = Field(description="YYYY-MM-DD")
    version: str | None
    strength: str | None
    strength_system: str | None = Field(description="e.g. uspstf, acc_aha, grade")
    criteria: list[ExtractedCriterion]

class ExtractedPolicy(BaseModel):
    policy_number: str
    doc_type: str = Field(description="e.g. medical_clinical_policy_bulletin")
    title: str
    coverage_effect: str = Field(description="e.g. covered, not_covered, covered_with_prior_auth")
    effective_date: str | None = Field(description="YYYY-MM-DD")
    last_reviewed: str | None = Field(description="YYYY-MM-DD")
    codes: list[ExtractedCode]
    criteria: list[ExtractedCriterion]


def _content(doc: SourceDocument) -> list[dict]:
    """Document as Anthropic multimodal parts: local Markdown plus scanned-page PNGs."""
    parsed = parser.parse_document(storage.get(doc.storage_uri), doc.media_type)
    text = parsed.markdown[:MAX_TEXT_CHARS]
    if not text.strip() and parsed.scanned_images:
        text = "[Document contains scanned pages; see attached images.]"
    parts: list[dict] = [{"type": "text", "text": text}]
    for png in parsed.scanned_images:
        data = base64.b64encode(png).decode()
        parts.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": data},
            }
        )
    return parts


async def extract[M: BaseModel](schema: type[M], instructions: str, doc: SourceDocument) -> M:
    """Ask the model to fill ``schema`` from ``doc``."""

    def _call() -> M:
        return client.create(
            modelId=settings.bedrock_model,
            system=[{"text": instructions}],
            messages=[{"role": "user", "content": _content(doc)}],
            response_model=schema,
            max_tokens=4096,
        )

    result = await asyncio.to_thread(_call)
    # Demo output goes directly to the backend console, independent of log level.
    print(
        f"\n--- LLM structured output: {doc.document_id} ({schema.__name__}) ---\n"
        f"{result.model_dump_json(indent=2)}\n"
        "--- End LLM structured output ---",
        flush=True,
    )
    return result


async def embed(texts: list[str]) -> list[list[float]]:
    """One embedding per text, in order. Empty input makes no API call."""
    if not texts:
        return []

    def _embed_all() -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in texts:
            response = bedrock_client.invoke_model(
                modelId=settings.bedrock_embedding_model,
                body=json.dumps({"inputText": text}),
                accept="application/json",
                contentType="application/json",
            )
            payload = json.loads(response["body"].read())
            embeddings.append(payload["embedding"])
        return embeddings

    return await asyncio.to_thread(_embed_all)
