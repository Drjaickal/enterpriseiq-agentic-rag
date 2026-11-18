import pytest

from ai_engine.chunking import chunk_text, ChunkMetadata


def test_chunk_text_basic():
    text = "This is a test document. " * 30

    chunks = chunk_text(
        text,
        chunk_size=100,
        chunk_overlap=20,
    )

    assert len(chunks) > 1
    assert all(len(chunk) <= 100 for chunk in chunks)


def test_empty_text():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_small_text():
    text = "Hello EnterpriseIQ"

    chunks = chunk_text(text)

    assert len(chunks) == 1
    assert chunks[0] == text


def test_invalid_chunk_size():
    with pytest.raises(ValueError):
        chunk_text("Hello", chunk_size=0)


def test_invalid_overlap():
    with pytest.raises(ValueError):
        chunk_text("Hello", chunk_size=100, chunk_overlap=100)


def test_metadata():
    metadata = ChunkMetadata(
        source="document.pdf",
        chunk_index=0,
        total_chunks=5,
    )

    result = metadata.to_dict()

    assert result["source"] == "document.pdf"
    assert result["chunk_index"] == 0
    assert result["total_chunks"] == 5
