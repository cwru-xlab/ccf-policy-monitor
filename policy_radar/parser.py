"""Local document pre-processing: bytes + media type -> Markdown, plus billing-code regex.

PDFs go through PyMuPDF / pymupdf4llm so headings, nested lists, and grid tables survive.
Scanned pages (almost no extractable text) are rendered to PNG for OCR or vision input.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

from bs4 import BeautifulSoup
from docx import Document as DocxDocument
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph

from policy_radar.enums import CodeSystem
from policy_radar.models import Code

SCANNED_TEXT_THRESHOLD = 50
PDF_RENDER_DPI = 200

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

_CPT_5 = re.compile(r"\b\d{5}\b")
_CPT_CAT_III = re.compile(r"\b\d{4}T\b")
_HCPCS = re.compile(r"\b[A-V]\d{4}\b")
_ICD10CM = re.compile(r"\b[A-TV-Z]\d{2}(?:\.[A-Z0-9]{1,4})?\b")
_BILLING_HINT = re.compile(
    r"(?i)\b(cpt|hcpcs|icd(?:-?10)?(?:-?cm)?|billing|procedure\s+code|diagnosis\s+code|code[s]?)\b"
)


@dataclass(frozen=True)
class ParsedDocument:
    """Markdown extracted from a document, plus PNG bytes for scanned PDF pages."""

    markdown: str
    scanned_images: tuple[bytes, ...] = ()
    scanned_page_numbers: tuple[int, ...] = ()  # 1-based


def extract_markdown(raw: bytes, media_type: str) -> str:
    """Convert ``raw`` to Markdown. Scanned PDF pages are omitted here; use ``parse_document``."""
    return parse_document(raw, media_type).markdown


def parse_document(raw: bytes, media_type: str) -> ParsedDocument:
    """Layout-aware parse of ``raw`` into Markdown and optional scanned-page images."""
    kind = (media_type or "").split(";")[0].strip().lower()
    if kind == "application/pdf":
        return _parse_pdf(raw)
    if kind == DOCX_MEDIA_TYPE:
        return ParsedDocument(markdown=_parse_docx(raw))
    if kind == "text/html":
        return ParsedDocument(markdown=_html_to_text(raw.decode("utf-8", errors="replace")))
    if kind in {"text/plain", "application/xml", "application/json"}:
        return ParsedDocument(markdown=raw.decode("utf-8", errors="replace"))
    return ParsedDocument(markdown=raw.decode("utf-8", errors="replace"))


def page_is_scanned(page, min_chars: int = SCANNED_TEXT_THRESHOLD) -> bool:
    """True when ``page`` has too little extractable text to treat as born-digital."""
    return len(page.get_text().strip()) < min_chars


def render_page_png(page, dpi: int = PDF_RENDER_DPI) -> bytes:
    """Rasterize a PDF page to PNG bytes at ``dpi``."""
    return page.get_pixmap(dpi=dpi).tobytes("png")


def extract_codes_regex(markdown_text: str) -> list[Code]:
    """Deterministic CPT / HCPCS / ICD-10-CM codes from Markdown (tables and billing context)."""
    found: list[Code] = []
    seen: set[tuple[str, str]] = set()

    def add(system: CodeSystem, value: str) -> None:
        key = (system.value, value)
        if key not in seen:
            seen.add(key)
            found.append(Code(system=system, value=value))

    for match in _CPT_CAT_III.finditer(markdown_text):
        add(CodeSystem.CPT, match.group(0).upper())
    
    for match in _CPT_5.finditer(markdown_text):
        if _in_billing_context(markdown_text, match.start(), match.end()):
            add(CodeSystem.CPT, match.group(0))
            
    for match in _HCPCS.finditer(markdown_text):
        if _in_billing_context(markdown_text, match.start(), match.end()):
            add(CodeSystem.HCPCS, match.group(0).upper())
            
    for match in _ICD10CM.finditer(markdown_text):
        code_str = match.group(0).upper()
        # ICD-10 codes with a decimal (e.g. E11.9) are specific enough, 
        # but 3-character codes without a dot require a billing context check to avoid false positives.
        if "." in code_str or _in_billing_context(markdown_text, match.start(), match.end()):
            add(CodeSystem.ICD10CM, code_str)
            
    return found


def _in_billing_context(text: str, start: int, end: int) -> bool:
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", end)
    line = text[line_start : len(text) if line_end < 0 else line_end]
    if "|" in line:
        return True
    window = text[max(0, start - 240) : min(len(text), end + 240)]
    return bool(_BILLING_HINT.search(window))


def _parse_pdf(raw: bytes) -> ParsedDocument:
    import fitz
    import pymupdf4llm

    doc = fitz.open(stream=raw, filetype="pdf")
    try:
        markdown = pymupdf4llm.to_markdown(doc, write_images=False, show_progress=False) or ""
        images: list[bytes] = []
        pages: list[int] = []
        for i, page in enumerate(doc, start=1):
            if page_is_scanned(page):
                images.append(render_page_png(page))
                pages.append(i)
        if pages:
            notes = "\n".join(f"[Scanned page {n}: image attached]" for n in pages)
            markdown = f"{markdown.rstrip()}\n\n{notes}\n" if markdown.strip() else notes + "\n"
        return ParsedDocument(
            markdown=markdown,
            scanned_images=tuple(images),
            scanned_page_numbers=tuple(pages),
        )
    finally:
        doc.close()


def _html_to_text(html: str) -> str:
    return BeautifulSoup(html, "html.parser").get_text("\n", strip=True)


def _parse_docx(raw: bytes) -> str:
    document = DocxDocument(io.BytesIO(raw))
    parts: list[str] = []
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            md = _paragraph_markdown(DocxParagraph(child, document))
            if md:
                parts.append(md)
        elif child.tag == qn("w:tbl"):
            md = _table_markdown(DocxTable(child, document))
            if md:
                parts.append(md)
    return "\n\n".join(parts)


def _numbering_level(paragraph: DocxParagraph) -> int | None:
    pPr = paragraph._p.pPr
    if pPr is None or pPr.numPr is None or pPr.numPr.ilvl is None:
        return None
    return int(pPr.numPr.ilvl.val)


def _paragraph_markdown(paragraph: DocxParagraph) -> str:
    text = paragraph.text.strip()
    if not text:
        return ""
    style = (paragraph.style.name or "") if paragraph.style is not None else ""
    heading = re.match(r"Heading (\d+)$", style)
    if heading:
        return f"{'#' * int(heading.group(1))} {text}"
    if style == "Title":
        return f"# {text}"
    level = _numbering_level(paragraph)
    if level is None and style.lower().startswith("list"):
        level = 0
    if level is not None:
        return f"{'  ' * level}- {text}"
    return text


def _table_markdown(table: DocxTable) -> str:
    rows = [[cell.text.strip().replace("\n", " ") for cell in row.cells] for row in table.rows]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    header, *body = rows
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join("---" for _ in header) + " |",
    ]
    for row in body:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)
