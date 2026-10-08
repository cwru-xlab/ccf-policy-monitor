"""Federal Register v1 ``documents.json`` (https://www.federalregister.gov/developers/documentation/api/v1). Keyless.

The connector asks for ``fields[]=document_number,html_url,raw_text_url`` only, so a list
page holds just those. An empty result has no ``results`` or ``total_pages`` key. The
``raw_text_url`` body is served as ``text/plain`` but is an HTML page wrapping a ``<pre>``;
it is stored as served and not modelled.
"""

from policy_radar.responses.base import ProviderModel


class Document(ProviderModel):
    document_number: str
    html_url: str
    raw_text_url: str


class DocumentList(ProviderModel):
    count: int = 0
    total_pages: int | None = None
    next_page_url: str | None = None
    results: tuple[Document, ...] = ()
