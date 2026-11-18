import os

from sqlalchemy.orm import Session
from time import perf_counter

from ai_engine.embeddings.ollama_embeddings import OllamaEmbeddingClient
from ai_engine.embeddings.vector_store import VectorStore


def semantic_search(
    query: str,
    db: Session,
    top_k: int = 5,
) -> list[dict]:
    """Find the most relevant document chunks for a query."""

    if not query or not query.strip():
        raise ValueError("Search query cannot be empty.")

    if top_k < 1:
        raise ValueError("top_k must be at least 1.")

    client = OllamaEmbeddingClient(
        model=os.getenv(
            "OLLAMA_EMBEDDING_MODEL",
            "nomic-embed-text",
        ),
        base_url=os.getenv(
            "OLLAMA_BASE_URL",
            "http://localhost:11434",
        ),
    )

    embedding_start = perf_counter()
    query_embedding = client.embed_query(query.strip())
    print(f"[SEARCH TIMING] Embedding: {perf_counter() - embedding_start:.3f}s")

    store = VectorStore(db)

    search_start = perf_counter()
    results = store.search(
    query_embedding=query_embedding,
    top_k=top_k,
)
    print(f"[SEARCH TIMING] Vector search: {perf_counter() - search_start:.3f}s")

    return results
