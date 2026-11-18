from pathlib import Path


def load_text(file_path: str | Path) -> list[dict]:
    """Extract text from a plain text file."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Text file not found: {path}")

    if path.suffix.lower() != ".txt":
        raise ValueError("Expected a TXT file")

    try:
        text = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        text = path.read_text(encoding="cp1252")

    text = text.strip()

    if not text:
        return []

    return [{
        "text": text,
        "metadata": {
            "source": path.name,
            "file_type": "txt",
            "page_number": None,
        },
    }]
