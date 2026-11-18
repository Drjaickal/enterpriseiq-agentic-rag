from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import Document, DocumentChunk


class VectorStore:

    def __init__(self, db: Session):
        self.db = db

    def add_document(
        self,
        document_id: str,
        filename: str,
        file_type: str,
        content_hash: str,
        chunks: list[dict],
    ) -> None:

        document = Document(
            id=document_id,
            filename=filename,
            file_type=file_type,
            content_hash=content_hash,
        )

        self.db.add(document)

        for item in chunks:
            chunk = DocumentChunk(
                document_id=document_id,
                chunk_index=item["chunk_index"],
                content=item["content"],
                embedding=item["embedding"],
                metadata_json=item.get("metadata", {}),
            )
            self.db.add(chunk)

        try:
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:

        if len(query_embedding) != 768:
            raise ValueError("Expected 768-dimensional query embedding")

        if top_k <= 0:
            raise ValueError("top_k must be greater than zero")

        distance = DocumentChunk.embedding.cosine_distance(
            query_embedding
        )

        statement = (
            select(DocumentChunk, distance.label("distance"))
            .order_by(distance)
            .limit(top_k)
        )

        results = self.db.execute(statement).all()

        return [
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "metadata": chunk.metadata_json,
                "similarity": 1.0 - float(distance_value),
            }
            for chunk, distance_value in results
        ]
