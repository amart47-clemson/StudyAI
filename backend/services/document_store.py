DOCUMENTS: dict[str, str] = {}


def store_document(doc_id: str, text: str) -> None:
    DOCUMENTS[doc_id] = text


def get_document(doc_id: str) -> str | None:
    return DOCUMENTS.get(doc_id)
