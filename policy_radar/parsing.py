"""Recognise an uploaded file's format and turn it into text the extractor can read.

The upload's declared content type and filename are only hints: a browser sends DOCX as
``application/octet-stream`` and anything can be renamed, so the bytes decide. PDFs are
not converted here; ``llm.py`` hands them to the model as native file inputs, which keeps
layout and scanned pages readable.
"""

import io
import zipfile
from typing import NamedTuple
from xml.etree import ElementTree

from bs4 import BeautifulSoup

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
HTML = "text/html"
TEXT = "text/plain"

SUPPORTED_MEDIA_TYPES = frozenset({PDF, DOCX, HTML, TEXT})

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_DOCX_XML_BYTES = 50 * 1024 * 1024  # uncompressed size of word/document.xml; zip-bomb guard

_TEXT_EXTENSIONS = {".html": HTML, ".htm": HTML, ".txt": TEXT, ".md": TEXT, ".markdown": TEXT}
_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


class Upload(NamedTuple):
    filename: str
    content: bytes
    media_type: str


class UnsupportedFormat(ValueError):
    """The bytes are not a format we can read."""


def _is_docx(content: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            return "word/document.xml" in z.namelist()
    except zipfile.BadZipFile:
        return False


def sniff_media_type(filename: str | None, declared: str | None, content: bytes) -> str | None:
    """The supported media type of ``content``, or None. Magic bytes beat the filename and the
    declared type, which only pick between the text formats that have no magic bytes."""
    if content.startswith(b"%PDF-"):
        return PDF
    if content.startswith(b"PK\x03\x04"):
        return DOCX if _is_docx(content) else None
    if b"\x00" in content[:4096]:
        return None  # binary content under a text name
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if filename and "." in filename else ""
    if ext in _TEXT_EXTENSIONS:
        return _TEXT_EXTENSIONS[ext]
    kind = (declared or "").split(";")[0].strip()
    return kind if kind in (HTML, TEXT) else None


def _docx_text(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        info = z.getinfo("word/document.xml")
        if info.file_size > MAX_DOCX_XML_BYTES:
            raise UnsupportedFormat("DOCX body is too large to read")
        root = ElementTree.fromstring(z.read(info))

    def paragraph(p: ElementTree.Element) -> str:
        parts = []
        for el in p.iter():
            if el.tag == f"{_W}t":
                parts.append(el.text or "")
            elif el.tag == f"{_W}tab":
                parts.append("\t")
            elif el.tag == f"{_W}br":
                parts.append("\n")
        return "".join(parts)

    body = root.find(f"{_W}body")
    if body is None:
        raise UnsupportedFormat("DOCX has no body")
    lines = []
    for child in body:
        if child.tag == f"{_W}p":
            lines.append(paragraph(child))
        elif child.tag == f"{_W}tbl":  # one line per row so criteria stay readable
            for row in child.iter(f"{_W}tr"):
                cells = [" ".join(paragraph(p) for p in c.iter(f"{_W}p")) for c in row.findall(f"{_W}tc")]
                lines.append(" | ".join(cells))
    return "\n".join(line for line in lines if line.strip())


def extract_text(media_type: str, content: bytes) -> str | None:
    """Plain text of ``content``, or None for a PDF (sent to the model as a file)."""
    if media_type == PDF:
        return None
    if media_type == DOCX:
        return _docx_text(content)
    text = content.decode("utf-8", errors="replace")
    if media_type == HTML:
        return BeautifulSoup(text, "html.parser").get_text("\n", strip=True)
    if media_type == TEXT:
        return text
    raise UnsupportedFormat(f"cannot read {media_type}")
