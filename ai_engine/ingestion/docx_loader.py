from pathlib import Path
from docx import Document


def load_docx(file_path: str | Path) -> list[dict]:
    """Extract paragraphs and tables from a DOCX document."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"DOCX not found: {path}")

    if path.suffix.lower() != ".docx":
        raise ValueError("Expected a DOCX file")

    document = Document(path)

    sections = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            sections.append(text)

    for table in document.tables:
        for row in table.rows:
            cells = [
                cell.text.strip()
                for cell in row.cells
            ]
            sections.append(" | ".join(cells))

    full_text = "\n".join(sections).strip()

    if not full_text:
        return []

    return [{
        "text": full_text,
        "metadata": {
            "source": path.name,
            "file_type": "docx",
            "page_number": None,
        },
    }]
