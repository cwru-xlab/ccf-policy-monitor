from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from policy_radar import api, db, storage


@pytest.mark.parametrize("collection", ["policies", "guidelines"])
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
async def test_policy_document_preview(monkeypatch, source, media_type, missing, expected, collection):
    if collection == 'guidelines':
        if source == db.CPB_SOURCE_KEY:
            source = db.GUIDELINE_UPLOAD_SOURCE_KEY
        elif source == 'other-source':
            source = db.CPB_SOURCE_KEY
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
        response = await client.get(f'/{collection}/documents/test-document')
    assert response.status_code == expected
    lookup.assert_awaited_once_with('test-document')
    if expected == 200:
        assert response.content == content
        assert response.headers['content-type'] == 'application/pdf'
        assert response.headers['content-disposition'].startswith('inline;')


@pytest.mark.parametrize('duplicate', [False, True])
async def test_guideline_upload_returns_document_id(monkeypatch, duplicate):
    content = b'%PDF-1.4 uploaded guideline'
    _, sha = storage.object_key(db.GUIDELINE_UPLOAD_SOURCE_KEY, content, 'application/pdf')
    document_id = f'{db.GUIDELINE_UPLOAD_SOURCE_KEY}-{sha[:16]}'
    monkeypatch.setattr(db, 'list_sources', AsyncMock(return_value=[]))
    monkeypatch.setattr(api.pipelines, 'store_document', AsyncMock(
        return_value=None if duplicate else SimpleNamespace(document_id=document_id)
    ))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api.app), base_url='http://test'
    ) as client:
        response = await client.post('/guidelines/documents', files={
            'files': ('guideline.pdf', content, 'application/pdf')
        })
    assert response.status_code == 201
    assert response.json() == {
        'stored': [] if duplicate else [document_id],
        'duplicates': [document_id] if duplicate else [],
    }
