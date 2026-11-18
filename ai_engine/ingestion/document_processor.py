from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone

from .pdf_loader import load_pdf
from .docx_loader import load_docx
from .text_loader import load_text


def process_document(file_path: str | Path) -> dict:
    """Process supported documents and attach stable metadata."""

    path = Path(file_path)

    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Document not found: {path}")

    extension = path.suffix.lower()

    loaders = {
        ".pdf": load_pdf,
        ".docx": load_docx,
        ".txt": load_text,
    }

    loader = loaders.get(extension)

    if loader is None:
        raise ValueError(f"Unsupported document format: {extension}")

    content_hash = sha256(path.read_bytes()).hexdigest()
    extracted_documents = loader(path)

    document_id = content_hash

    for index, item in enumerate(extracted_documents):
        item["metadata"].update({
            "document_id": document_id,
            "chunk_index": index,
            "content_hash": content_hash,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "document_id": document_id,
        "filename": path.name,
        "file_type": extension.lstrip("."),
        "total_pages_or_sections": len(extracted_documents),
        "documents": extracted_documents,
    }
