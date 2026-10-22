"""NCBI E-utilities: ``esearch`` (JSON) and ``efetch`` (XML) on db=pubmed (https://www.ncbi.nlm.nih.gov/books/NBK25499/). Keyless; a key raises 3 to 10 req/s.

esearch errors arrive with HTTP 200 in ``esearchresult.ERROR``, and its body can hold control
characters (parse with ``json.loads(strict=False)``). A malformed term is not an error: PubMed
falls back to an all-fields search. efetch XML is stored as served; ``parse_articles`` reads
only the fields below.
"""

import xml.etree.ElementTree as ET
from datetime import date

from pydantic import Field

from policy_radar.responses.base import ProviderModel


class ESearchResult(ProviderModel):
    count: int
    idlist: tuple[str, ...] = ()
    error: str | None = Field(default=None, alias="ERROR")


class ESearchResponse(ProviderModel):
    esearchresult: ESearchResult


class Article(ProviderModel):
    pmid: str
    title: str
    publication_types: tuple[str, ...]
    date_revised: date | None = None
    journal: str | None = None
    doi: str | None = None


def _date(node: ET.Element | None) -> date | None:
    if node is None:
        return None
    return date(int(node.findtext("Year")), int(node.findtext("Month")), int(node.findtext("Day")))


def article_from_xml(node: ET.Element) -> Article:
    pmid = node.findtext("MedlineCitation/PMID")
    if not pmid:
        raise ValueError("PubmedArticle without a PMID")
    title = node.find("MedlineCitation/Article/ArticleTitle")
    return Article(
        pmid=pmid,
        title="".join(title.itertext()).strip() if title is not None else "",  # titles hold <i> etc.
        publication_types=tuple(
            t.text or "" for t in node.iterfind("MedlineCitation/Article/PublicationTypeList/PublicationType")
        ),
        date_revised=_date(node.find("MedlineCitation/DateRevised")),
        journal=node.findtext("MedlineCitation/Article/Journal/Title"),
        doi=node.findtext("MedlineCitation/Article/ELocationID[@EIdType='doi']"),
    )


def parse_articles(xml: bytes) -> tuple[Article, ...]:
    return tuple(article_from_xml(n) for n in ET.fromstring(xml).iter("PubmedArticle"))
