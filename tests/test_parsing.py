"""Format detection and text extraction for uploaded policy files."""

import io
import zipfile

import pytest

from policy_radar import parsing

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def make_docx(body_xml: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", f"<w:document {W}><w:body>{body_xml}</w:body></w:document>")
    return buf.getvalue()


def p(text: str) -> str:
    return f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"


def test_pdf_is_recognised_by_magic_bytes_whatever_the_name():
    assert parsing.sniff_media_type("notes.txt", "text/plain", b"%PDF-1.7 ...") == parsing.PDF


def test_docx_is_recognised_even_when_declared_as_octet_stream():
    docx = make_docx(p("hello"))
    assert parsing.sniff_media_type("cpb.docx", "application/octet-stream", docx) == parsing.DOCX


def test_a_zip_that_is_not_a_docx_is_rejected():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("a.txt", "x")
    assert parsing.sniff_media_type("cpb.docx", None, buf.getvalue()) is None


@pytest.mark.parametrize(
    ("name", "declared", "expected"),
    [("a.html", None, parsing.HTML), ("a.htm", "text/plain", parsing.HTML), ("a.md", None, parsing.TEXT),
     ("a", "text/html; charset=utf-8", parsing.HTML), ("a.exe", "application/octet-stream", None),
     (None, None, None)],
)
def test_text_formats_use_extension_then_declared_type(name, declared, expected):
    assert parsing.sniff_media_type(name, declared, b"<p>hi</p>") == expected


def test_binary_content_under_a_text_name_is_rejected():
    assert parsing.sniff_media_type("a.txt", "text/plain", b"ab\x00cd") is None


def test_docx_text_keeps_paragraph_order_and_flattens_tables_by_row():
    table = (
        "<w:tbl><w:tr><w:tc>" + p("Code") + "</w:tc><w:tc>" + p("Meaning") + "</w:tc></w:tr>"
        "<w:tr><w:tc>" + p("45378") + "</w:tc><w:tc>" + p("Colonoscopy") + "</w:tc></w:tr></w:tbl>"
    )
    text = parsing.extract_text(parsing.DOCX, make_docx(p("Policy") + table + p("End")))
    assert text == "Policy\nCode | Meaning\n45378 | Colonoscopy\nEnd"


def test_docx_tabs_and_breaks_become_whitespace():
    body = "<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>"
    assert parsing.extract_text(parsing.DOCX, make_docx(body)) == "a\tb\nc"


def test_oversized_docx_body_is_refused(monkeypatch):
    monkeypatch.setattr(parsing, "MAX_DOCX_XML_BYTES", 10)
    with pytest.raises(parsing.UnsupportedFormat):
        parsing.extract_text(parsing.DOCX, make_docx(p("hello world")))


def test_html_is_stripped_to_text_and_pdf_is_left_for_the_model():
    assert parsing.extract_text(parsing.HTML, b"<h1>Title</h1><p>Body</p>") == "Title\nBody"
    assert parsing.extract_text(parsing.PDF, b"%PDF-1.4") is None
    assert parsing.extract_text(parsing.TEXT, "café".encode()) == "café"
