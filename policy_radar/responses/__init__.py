"""Pydantic models for what each guideline provider actually serves.

One module per provider. They validate a response and give the connectors typed access to
the fields they depend on; they never replace the bytes that get stored (see docs/INGESTION_SPEC.md).
"""
