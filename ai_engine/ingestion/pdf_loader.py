from pathlib import Path
import fitz


def load_pdf(file_path: str | Path) -> list[dict]:
    """Extract text from each PDF page while preserving page numbers."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError("Expected a PDF file")

    documents = []

    with fitz.open(path) as pdf:
        for page_index, page in enumerate(pdf):
            text = page.get_text("text").strip()

            if not text:
                continue

            documents.append({
                "text": text,
                "metadata": {
                    "source": path.name,
                    "file_type": "pdf",
                    "page_number": page_index + 1,
                },
            })

    return documents
