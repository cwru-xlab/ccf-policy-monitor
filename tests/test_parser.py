"""Local parser, regex code extraction, and pipeline fallbacks (no live OpenAI)."""

from datetime import UTC, date, datetime
from io import BytesIO

import fitz
import pytest
from docx import Document as DocxDocument

from policy_radar import llm, parser, pipelines
from policy_radar.enums import (
    CodeSystem,
    CoverageEffect,
    PolicyDocumentType,
    StrengthSystem,
)
from policy_radar.models import SourceDocument
from policy_radar.parser import DOCX_MEDIA_TYPE


def _sample_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 64), "Coverage Policy", fontsize=18)
    page.insert_text((72, 92), "Medical Necessity Criteria", fontsize=14)
    page.insert_text((72, 120), "All of the following:", fontsize=11)
    page.insert_text((90, 138), "Age 18 years or older", fontsize=11)
    page.insert_text((90, 154), "Documented type 2 diabetes", fontsize=11)
    page.insert_text((72, 178), "Any of the following:", fontsize=11)
    page.insert_text((90, 196), "Failure of conservative therapy", fontsize=11)
    page.insert_text((90, 212), "Contraindication to surgery", fontsize=11)

    headers = ["Code", "System", "Description"]
    rows = [
        headers,
        ["99213", "CPT", "Office visit"],
        ["0042T", "CPT", "Category III"],
        ["G0101", "HCPCS", "Cervical screening"],
        ["J0129", "HCPCS", "Injection"],
        ["E11.9", "ICD-10-CM", "Type 2 diabetes"],
        ["Z12.31", "ICD-10-CM", "Mammography encounter"],
    ]
    origin_x, origin_y = 72, 250
    col_w, row_h = 130, 18
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            rect = fitz.Rect(
                origin_x + c * col_w,
                origin_y + r * row_h,
                origin_x + (c + 1) * col_w,
                origin_y + (r + 1) * row_h,
            )
            page.draw_rect(rect, color=(0, 0, 0), width=0.4)
            page.insert_textbox(rect, cell, fontsize=8, align=fitz.TEXT_ALIGN_CENTER)

    page2 = doc.new_page()
    page2.insert_text((72, 72), "Appendix: additional nested bullets", fontsize=14)
    page2.insert_text((72, 100), "All of the following remain required.", fontsize=11)
    raw = doc.tobytes()
    doc.close()
    return raw


def _scanned_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.draw_rect(fitz.Rect(40, 40, 500, 700), color=(0, 0, 0), fill=(0.35, 0.35, 0.35))
    raw = doc.tobytes()
    doc.close()
    return raw


def _doc(**kwargs) -> SourceDocument:
    return SourceDocument(
        document_id=kwargs.get("document_id", "doc-1"),
        source_key=kwargs.get("source_key", "cpb_upload"),
        retrieved_at=kwargs.get("retrieved_at", datetime(2026, 3, 15, tzinfo=UTC)),
        storage_uri=kwargs.get("storage_uri", "cpb_upload/x.txt"),
        content_sha256="a" * 64,
        media_type=kwargs.get("media_type", "text/plain"),
        origin_url=None,
    )


def test_extract_markdown_preserves_headings_nested_lists_and_table_codes():
    md = parser.extract_markdown(_sample_pdf_bytes(), "application/pdf")
    lower = md.lower()
    assert "coverage policy" in lower
    assert "medical necessity" in lower
    assert "all of the following" in lower
    assert "age 18" in lower
    assert "any of the following" in lower
    for token in ("99213", "0042T", "G0101", "J0129", "E11.9", "Z12.31"):
        assert token in md


def test_scanned_page_detection_and_png_render():
    doc = fitz.open(stream=_scanned_pdf_bytes(), filetype="pdf")
    page = doc[0]
    assert parser.page_is_scanned(page)
    png = parser.render_page_png(page)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    doc.close()

    parsed = parser.parse_document(_scanned_pdf_bytes(), "application/pdf")
    assert parsed.scanned_page_numbers == (1,)
    assert len(parsed.scanned_images) == 1
    assert parsed.scanned_images[0][:8] == b"\x89PNG\r\n\x1a\n"


def test_mixed_pdf_flags_only_scanned_pages():
    digital = fitz.open(stream=_sample_pdf_bytes(), filetype="pdf")
    scanned = fitz.open(stream=_scanned_pdf_bytes(), filetype="pdf")
    mixed = fitz.open()
    mixed.insert_pdf(digital)
    mixed.insert_pdf(scanned)
    raw = mixed.tobytes()
    digital.close()
    scanned.close()
    mixed.close()

    parsed = parser.parse_document(raw, "application/pdf")
    assert parsed.scanned_page_numbers == (3,)
    assert "99213" in parsed.markdown
    assert "Scanned page 3" in parsed.markdown


def test_extract_codes_regex_from_markdown_table():
    md = """
## Billing codes

| Code   | System    | Description        |
| ------ | --------- | ------------------ |
| 99213  | CPT       | Office visit       |
| 0042T  | CPT III   | Category III       |
| G0101  | HCPCS     | Cervical screening |
| J0129  | HCPCS     | Injection          |
| E11.9  | ICD-10-CM | Type 2 diabetes    |
| Z12.31 | ICD-10-CM | Screening mammo    |
"""
    codes = parser.extract_codes_regex(md)
    pairs = {(c.system, c.value) for c in codes}
    assert (CodeSystem.CPT, "99213") in pairs
    assert (CodeSystem.CPT, "0042T") in pairs
    assert (CodeSystem.HCPCS, "G0101") in pairs
    assert (CodeSystem.HCPCS, "J0129") in pairs
    assert (CodeSystem.ICD10CM, "E11.9") in pairs
    assert (CodeSystem.ICD10CM, "Z12.31") in pairs
    assert len(codes) == len(pairs)


def test_extract_markdown_html_and_plain_text():
    html = b"<html><body><h1>Title</h1><p>Criterion one.</p></body></html>"
    assert "Title" in parser.extract_markdown(html, "text/html")
    assert "Criterion one." in parser.extract_markdown(html, "text/html")
    assert "<h1>" not in parser.extract_markdown(html, "text/html")
    assert parser.extract_markdown(b"plain criterion", "text/plain") == "plain criterion"


def test_extract_markdown_docx_headings_lists_tables():
    document = DocxDocument()
    document.add_heading("Society Guideline", level=1)
    document.add_paragraph("All of the following:")
    document.add_paragraph("Adults 40 years or older", style="List Bullet")
    table = document.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Code"
    table.rows[0].cells[1].text = "System"
    table.rows[1].cells[0].text = "99213"
    table.rows[1].cells[1].text = "CPT"
    buf = BytesIO()
    document.save(buf)
    md = parser.extract_markdown(buf.getvalue(), DOCX_MEDIA_TYPE)
    assert md.startswith("# Society Guideline")
    assert "All of the following" in md
    assert "Adults 40 years or older" in md
    assert "99213" in md
    assert "|" in md


@pytest.mark.asyncio
async def test_parse_cpb_effective_date_fallback_and_regex_code_merge(monkeypatch):
    captured: dict = {}

    async def fake_extract(schema, instructions, doc):
        return llm.ExtractedPolicy(
            policy_number="0584",
            doc_type=PolicyDocumentType.MEDICAL_CLINICAL_POLICY_BULLETIN,
            title="Test CPB",
            coverage_effect=CoverageEffect.COVERED,
            effective_date=None,
            last_reviewed=None,
            codes=[llm.ExtractedCode(system=CodeSystem.CPT, value="99213")],
            criteria=[llm.ExtractedCriterion(text="Age 18 or older", concept_words=["age"])],
        )

    async def fake_embed(texts):
        return [[0.0] * 4 for _ in texts]

    async def fake_save(p, embeddings):
        captured["policy"] = p

    monkeypatch.setattr(pipelines.llm, "extract", fake_extract)
    monkeypatch.setattr(pipelines.llm, "embed", fake_embed)
    monkeypatch.setattr(pipelines.db, "save_policy", fake_save)
    monkeypatch.setattr(
        pipelines.storage,
        "get",
        lambda uri: b"| Code | System |\n| 99213 | CPT |\n| G0101 | HCPCS |\n| E11.9 | ICD |\n",
    )

    await pipelines._parse_cpb(_doc())
    policy = captured["policy"]
    assert policy.effective_date == date(2026, 3, 15)
    pairs = [(c.system, c.value) for c in policy.codes]
    assert pairs[0] == (CodeSystem.CPT, "99213")
    assert (CodeSystem.HCPCS, "G0101") in pairs
    assert (CodeSystem.ICD10CM, "E11.9") in pairs


@pytest.mark.asyncio
async def test_atomize_coerces_invalid_strength_instead_of_crashing(monkeypatch):
    captured: dict = {}

    async def fake_extract(schema, instructions, doc):
        return llm.ExtractedGuideline(
            title="Screening guideline",
            published=None,
            version=None,
            strength="Z",
            strength_system=StrengthSystem.USPSTF,
            criteria=[llm.ExtractedCriterion(text="Screen adults", concept_words=["screen"])],
        )

    async def fake_embed(texts):
        return [[0.0] * 4 for _ in texts]

    async def fake_save(g, embeddings):
        captured["guideline"] = g

    monkeypatch.setattr(pipelines.llm, "extract", fake_extract)
    monkeypatch.setattr(pipelines.llm, "embed", fake_embed)
    monkeypatch.setattr(pipelines.db, "save_guideline", fake_save)

    await pipelines._atomize(_doc(source_key="guideline_upload", document_id="g-1"))
    g = captured["guideline"]
    assert g.published == date(2026, 3, 15)
    assert g.strength is None
    assert g.strength_system is None
    assert g.title == "Screening guideline"


@pytest.mark.asyncio
async def test_atomize_drops_unpaired_strength(monkeypatch):
    captured: dict = {}

    async def fake_extract(schema, instructions, doc):
        return llm.ExtractedGuideline(
            title="Unpaired",
            published="2025-01-01",
            version="1",
            strength="A",
            strength_system=None,
            criteria=[],
        )

    async def fake_embed(texts):
        return []

    async def fake_save(g, embeddings):
        captured["g"] = g

    monkeypatch.setattr(pipelines.llm, "extract", fake_extract)
    monkeypatch.setattr(pipelines.llm, "embed", fake_embed)
    monkeypatch.setattr(pipelines.db, "save_guideline", fake_save)

    await pipelines._atomize(_doc(source_key="guideline_upload"))
    assert captured["g"].strength is None
    assert captured["g"].strength_system is None
    assert captured["g"].published == date(2025, 1, 1)


def test_llm_content_uses_markdown_and_scanned_images(monkeypatch):
    monkeypatch.setattr(llm.storage, "get", lambda uri: _scanned_pdf_bytes())
    parts = llm._content(_doc(media_type="application/pdf", storage_uri="x.pdf"))
    assert parts[0]["type"] == "text"
    assert parts[0]["text"]
    assert any(p["type"] == "image" for p in parts)
    assert "file_data" not in str(parts)
