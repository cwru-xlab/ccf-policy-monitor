"""Dry-run inspector for testing parser.py + llm.py on real local files without Postgres.

Usage:
  # 1. Inspect local Markdown + Regex code extraction only (free, no OpenAI call):
  uv run python scripts/inspect_parse.py path/to/policy.pdf --mode policy --dry-run

  # 2. Full end-to-end parse into the Policy or Guideline model (calls OpenAI, no DB needed):
  uv run python scripts/inspect_parse.py path/to/policy.pdf --mode policy
  uv run python scripts/inspect_parse.py path/to/guideline.pdf --mode guideline
"""

import argparse
import asyncio
import json
import mimetypes
import uuid
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

from policy_radar import llm, parser, pipelines
from policy_radar.models import (
    Code,
    Guideline,
    GuidelineCriterion,
    Policy,
    PolicyCriterion,
    SourceDocument,
)

MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": parser.DOCX_MEDIA_TYPE,
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
}


async def run_inspection(file_path: Path, mode: str, dry_run: bool, dump_md: Path | None) -> None:
    raw = file_path.read_bytes()
    media_type = MIME_MAP.get(file_path.suffix.lower()) or mimetypes.guess_type(file_path.name)[0] or "text/plain"

    print(f"=== 1. LOCAL PARSING ({file_path.name} as {media_type}) ===")
    parsed = parser.parse_document(raw, media_type)
    regex_codes = parser.extract_codes_regex(parsed.markdown)

    print(f"Markdown length      : {len(parsed.markdown):,} chars")
    print(f"Scanned pages found  : {len(parsed.scanned_page_numbers)} {parsed.scanned_page_numbers}")
    print(f"Regex codes extracted: {len(regex_codes)}")

    if dump_md:
        dump_md.write_text(parsed.markdown, encoding="utf-8")
        print(f"Saved extracted Markdown to: {dump_md}")
    else:
        preview = parsed.markdown[:1200]
        print(f"\n--- Markdown Preview (first 1,200 chars) ---\n{preview}\n" + ("-" * 44))

    if regex_codes:
        by_sys: dict[str, list[str]] = {}
        for c in regex_codes:
            by_sys.setdefault(c.system.value, []).append(c.value)
        print("\n--- Regex Extracted Codes ---")
        for sys_name, vals in by_sys.items():
            print(f"  {sys_name.upper()} ({len(vals)}): {', '.join(vals[:15])}{' ...' if len(vals) > 15 else ''}")

    if dry_run:
        return

    print(f"\n=== 2. LLM STRUCTURED EXTRACTION (mode={mode}) ===")
    fake_doc = SourceDocument(
        document_id=f"inspect-{uuid.uuid4().hex[:8]}",
        source_key="cpb_upload" if mode == "policy" else "guideline_upload",
        retrieved_at=datetime.now(UTC),
        storage_uri="memory://inspect",
        content_sha256="0" * 64,
        media_type=media_type,
    )

    # Patch storage.get so llm._content reads our local file bytes directly
    with patch("policy_radar.storage.get", return_value=raw):
        if mode == "policy":
            x = await llm.extract(llm.ExtractedPolicy, llm.POLICY_PROMPT, fake_doc)
            model_obj = Policy(
                policy_number=x.policy_number,
                doc_type=x.doc_type,
                title=x.title,
                criteria=pipelines._criteria(PolicyCriterion, x.policy_number, x.criteria),
                codes=pipelines._merge_codes(x.codes, regex_codes),
                coverage_effect=x.coverage_effect,
                effective_date=x.effective_date or fake_doc.retrieved_at.date(),
                last_reviewed=x.last_reviewed,
                document_id=fake_doc.document_id,
            )
        else:
            x = await llm.extract(llm.ExtractedGuideline, llm.GUIDELINE_PROMPT, fake_doc)
            gid = uuid.uuid4().hex
            strength, strength_system = pipelines._sanitize_strength(x.strength, x.strength_system)
            model_obj = Guideline(
                guideline_id=gid,
                source_key=fake_doc.source_key,
                document_id=fake_doc.document_id,
                title=x.title,
                criteria=pipelines._criteria(GuidelineCriterion, gid, x.criteria),
                published=x.published or fake_doc.retrieved_at.date(),
                version=x.version,
                strength=strength,
                strength_system=strength_system,
            )

    print(json.dumps(model_obj.model_dump(mode="json"), indent=2))


def main() -> None:
    ap = argparse.ArgumentParser(description="Inspect PDF/DOCX parsing into Policy or Guideline models.")
    ap.add_argument("file", type=Path, help="Path to local PDF, DOCX, HTML, or TXT file")
    ap.add_argument("--mode", choices=["policy", "guideline"], default="policy")
    ap.add_argument("--dry-run", action="store_true", help="Only run local Markdown + regex (no OpenAI call)")
    ap.add_argument("--dump-md", type=Path, default=None, help="Write the extracted Markdown to a file to inspect tables")
    args = ap.parse_args()

    asyncio.run(run_inspection(args.file, args.mode, args.dry_run, args.dump_md))


if __name__ == "__main__":
    main()