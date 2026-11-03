from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from policy_radar import api, db, storage


@pytest.mark.parametrize(
    ('source', 'media_type', 'missing', 'expected'),
    [
        (db.CPB_SOURCE_KEY, 'application/pdf', False, 200),
        (db.CPB_SOURCE_KEY, 'application/pdf', True, 404),
        (db.CPB_SOURCE_KEY, 'text/html', False, 415),
        ('other-source', 'application/pdf', False, 404),
        (None, 'application/pdf', False, 404),
    ],
)
async def test_policy_document_preview(monkeypatch, source, media_type, missing, expected):
    doc = SimpleNamespace(source_key=source, media_type=media_type, storage_uri='stored.pdf')
    lookup = AsyncMock(return_value=doc if source else None)
    monkeypatch.setattr(db, 'get_source_document', lookup)
    content = b'%PDF-1.4\noriginal uploaded bytes'

    def read(key):
        assert key == 'stored.pdf'
        if missing:
            raise FileNotFoundError(key)
        return content

    monkeypatch.setattr(storage, 'get', read)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api.app), base_url='http://test'
    ) as client:
        response = await client.get('/policies/documents/test-document')
    assert response.status_code == expected
    lookup.assert_awaited_once_with('test-document')
    if expected == 200:
        assert response.content == content
        assert response.headers['content-type'] == 'application/pdf'
        assert response.headers['content-disposition'].startswith('inline;')
