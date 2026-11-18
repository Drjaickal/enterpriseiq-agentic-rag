from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChunkMetadata:
    source: str
    chunk_index: int
    total_chunks: int
    page: int | None = None
    document_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "page": self.page,
            "document_id": self.document_id,
            **self.extra,
        }
