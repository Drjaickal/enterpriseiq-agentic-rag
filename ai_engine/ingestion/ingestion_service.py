import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import Document
from ai_engine.ingestion.document_processor import process_document
from ai_engine.chunking import chunk_text
from ai_engine.embeddings.ollama_embeddings import OllamaEmbeddingClient
from ai_engine.embeddings.vector_store import VectorStore


def ingest_document(
    file_path: str | Path,
    db: Session,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> dict:
    """Extract, chunk, embed, and store a document."""

    processed = process_document(file_path)
    document_id = processed["document_id"]

    existing = db.scalar(
        select(Document).where(Document.content_hash == document_id)
    )

    if existing:
        return {
            "status": "already_exists",
            "document_id": existing.id,
            "filename": existing.filename,
            "message": "This document has already been ingested.",
        }

    prepared_chunks = []

    for document in processed["documents"]:
        pieces = chunk_text(
            document["text"],
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

        for piece in pieces:
            prepared_chunks.append({
                "content": piece,
                "metadata": document["metadata"].copy(),
            })

    if not prepared_chunks:
        raise ValueError("No text content found in the document.")

    embedding_client = OllamaEmbeddingClient(
        model=os.getenv(
            "OLLAMA_EMBEDDING_MODEL",
            "nomic-embed-text",
        ),
        base_url=os.getenv(
            "OLLAMA_BASE_URL",
            "http://localhost:11434",
        ),
    )

    texts = [item["content"] for item in prepared_chunks]
    embeddings = embedding_client.embed_texts(texts)

    if len(embeddings) != len(prepared_chunks):
        raise ValueError("Embedding count does not match chunk count.")

    chunks_for_storage = []

    for index, (item, embedding) in enumerate(
        zip(prepared_chunks, embeddings)
    ):
        metadata = item["metadata"]
        metadata["chunk_index"] = index

        chunks_for_storage.append({
            "chunk_index": index,
            "content": item["content"],
            "embedding": embedding,
            "metadata": metadata,
        })

    vector_store = VectorStore(db)

    vector_store.add_document(
        document_id=document_id,
        filename=processed["filename"],
        file_type=processed["file_type"],
        content_hash=document_id,
        chunks=chunks_for_storage,
    )

    return {
        "status": "success",
        "document_id": document_id,
        "filename": processed["filename"],
        "file_type": processed["file_type"],
        "total_chunks": len(chunks_for_storage),
        "message": "Document ingested successfully.",
    }
