from types import SimpleNamespace

import pytest

from ai_engine.embeddings import OllamaEmbeddingClient


def test_embed_empty_texts():
    client = OllamaEmbeddingClient()
    assert client.embed_texts([]) == []


def test_embed_texts_success(monkeypatch):
    vectors = [[0.1] * 768, [0.2] * 768]

    def mock_post(*args, **kwargs):
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"embeddings": vectors},
        )

    monkeypatch.setattr("httpx.post", mock_post)

    client = OllamaEmbeddingClient()
    result = client.embed_texts(["hello", "world"])

    assert len(result) == 2
    assert len(result[0]) == 768


def test_embed_query_success(monkeypatch):
    vector = [0.1] * 768

    def mock_post(*args, **kwargs):
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"embeddings": [vector]},
        )

    monkeypatch.setattr("httpx.post", mock_post)

    client = OllamaEmbeddingClient()
    result = client.embed_query("Enterprise RAG")

    assert len(result) == 768


def test_embedding_count_mismatch(monkeypatch):
    def mock_post(*args, **kwargs):
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"embeddings": [[0.1] * 768]},
        )

    monkeypatch.setattr("httpx.post", mock_post)

    client = OllamaEmbeddingClient()

    with pytest.raises(ValueError, match="count mismatch"):
        client.embed_texts(["hello", "world"])


def test_embedding_dimension_mismatch(monkeypatch):
    def mock_post(*args, **kwargs):
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"embeddings": [[0.1] * 384]},
        )

    monkeypatch.setattr("httpx.post", mock_post)

    client = OllamaEmbeddingClient()

    with pytest.raises(ValueError, match="dimensions"):
        client.embed_texts(["hello"])
