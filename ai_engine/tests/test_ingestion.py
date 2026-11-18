from pathlib import Path
import pytest

from ai_engine.ingestion import (
    load_text,
    process_document,
)


def test_load_text(tmp_path):
    file = tmp_path / "sample.txt"
    file.write_text("EnterpriseIQ RAG test", encoding="utf-8")

    result = load_text(file)

    assert len(result) == 1
    assert result[0]["text"] == "EnterpriseIQ RAG test"
    assert result[0]["metadata"]["file_type"] == "txt"


def test_process_document(tmp_path):
    file = tmp_path / "sample.txt"
    file.write_text("Enterprise knowledge platform", encoding="utf-8")

    result = process_document(file)

    assert result["filename"] == "sample.txt"
    assert len(result["document_id"]) == 64
    assert result["documents"][0]["metadata"]["chunk_index"] == 0


def test_unsupported_file(tmp_path):
    file = tmp_path / "sample.csv"
    file.write_text("a,b,c", encoding="utf-8")

    with pytest.raises(ValueError):
        process_document(file)


def test_missing_file():
    with pytest.raises(FileNotFoundError):
        process_document("missing.txt")
