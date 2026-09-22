import hashlib
import re
import uuid

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from models import (
    Base,
    Code,
    Criterion,
    Policy,
    PolicyDocType,
    SourceDocument,
    get_engine,
    get_session_factory,
)


def _concept_words(description: str, limit: int = 4) -> list[str]:
    words = [word.strip(",;") for word in description.split() if len(word) > 4]
    return words[:limit]


def scrape_aetna_policy_to_sql(
    url: str,
    policy_number: str,
    session: Session,
    *,
    doc_type: PolicyDocType = PolicyDocType.MEDICAL,
) -> Policy | None:
    """
    Scrape an Aetna CPB page and persist Policy, Code, and Criterion rows
    using the normalized SQLAlchemy model (criteria stay independent of policy
    so they can be vectorized for RAG).
    """
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(f"Failed to fetch page. Status code: {response.status_code}")
        return None

    soup = BeautifulSoup(response.content, "html.parser")

    code_table = None
    for table in soup.find_all("table"):
        th_texts = [th.get_text(strip=True).lower() for th in table.find_all(["th", "td"])]
        if "code" in th_texts and "code description" in th_texts:
            code_table = table
            break

    if not code_table:
        print("Could not locate the Code / Code Description table.")
        return None

    heading = soup.find("h1")
    title = heading.get_text(strip=True) if heading else f"Aetna CPB {policy_number}"

    source_document = SourceDocument(
        document_id=uuid.uuid4(),
        source_key=f"aetna:{policy_number}",
        storage_uri=url,
        content_sha256=hashlib.sha256(response.content).hexdigest(),
        origin_url=url,
    )
    session.add(source_document)

    policy = session.get(Policy, policy_number)
    if policy is None:
        policy = Policy(
            policy_number=policy_number,
            doc_type=doc_type,
            title=title,
        )
        session.add(policy)
    else:
        policy.title = title
        policy.doc_type = doc_type

    current_system = "CPT"
    codes_added = 0
    criteria_added = 0
    existing_code_keys = {(code.system, code.value) for code in policy.codes}
    existing_criterion_texts = {criterion.text for criterion in policy.criteria}

    for row in code_table.find_all("tr"):
        cells = row.find_all(["td", "th"])

        if len(cells) == 1 or (len(cells) == 2 and cells[1].get_text(strip=True) == ""):
            header_text = cells[0].get_text(strip=True).upper()
            if "CPT" in header_text:
                current_system = "CPT"
            elif "HCPCS" in header_text:
                current_system = "HCPCS"
            elif "ICD-10" in header_text:
                current_system = "ICD-10"
            continue

        if len(cells) < 2:
            continue

        raw_code = cells[0].get_text(strip=True)
        raw_desc = cells[1].get_text(strip=True)

        if raw_code.lower() == "code" or not raw_code:
            continue

        clean_code = re.sub(r"\s+", " ", raw_code)
        clean_desc = re.sub(r"\s+", " ", raw_desc)

        if (current_system, clean_code) not in existing_code_keys:
            code = Code(system=current_system, value=clean_code)
            policy.codes.append(code)
            existing_code_keys.add((current_system, clean_code))
            codes_added += 1

        if clean_desc and clean_desc not in existing_criterion_texts:
            criterion = Criterion(
                text=clean_desc,
                concept_words=_concept_words(clean_desc),
                needs_update=False,
            )
            policy.criteria.append(criterion)
            existing_criterion_texts.add(clean_desc)
            criteria_added += 1

    session.flush()
    print(
        f"Persisted Aetna policy {policy_number}: "
        f"{codes_added} codes, {criteria_added} criteria "
        f"(source_document={source_document.document_id})"
    )
    return policy


if __name__ == "__main__":
    engine = get_engine()
    Base.metadata.create_all(engine)
    SessionFactory = get_session_factory(engine)

    with SessionFactory() as session:
        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/500_599/0584.html",
            policy_number="0584",
            session=session,
        )
        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/1000_1099/1004.html",
            policy_number="1004",
            session=session,
        )

        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/200_299/0236.html",
            policy_number="0236",
            session=session,
        )

        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/100_199/0171.html",
            policy_number="0171",
            session=session,
        )

        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/900_999/0937.html",
            policy_number="0937",
            session=session,
        )

        scrape_aetna_policy_to_sql(
            url="https://www.aetna.com/cpb/medical/data/1000_1099/1009.html",
            policy_number="1009",
            session=session,
        )

        session.commit()

        # policy = session.get(Policy, "0584")
        # if policy is not None:
        #     print(f"Policy title: {policy.title}")
        #     print(f"Linked codes: {len(policy.codes)}")
        #     print(f"Linked criteria: {len(policy.criteria)}")
        #     if policy.codes:
        #         sample = policy.codes[0]
        #         print(f"Sample code: {sample.system} {sample.value}")
        #     if policy.criteria:
        #         sample_c = policy.criteria[0]
        #         print(f"Sample criterion: {sample_c.text[:120]}")
        #         print(f"Sample concepts: {sample_c.concept_words}")
