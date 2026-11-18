from sqlalchemy import select
from database.connection import SessionLocal
from database.models import Document, DocumentChunk

db = SessionLocal()

try:
    documents = db.scalars(select(Document)).all()

    print("\n========== DOCUMENTS ==========")

    for document in documents:
        print("Filename:", document.filename)
        print("File type:", document.file_type)
        print("Document ID:", document.id)

    chunks = db.scalars(
        select(DocumentChunk).order_by(DocumentChunk.chunk_index)
    ).all()

    print("\n========== STORED CHUNKS ==========")
    print("Total chunks:", len(chunks))

    for chunk in chunks:
        print(f"\nChunk {chunk.chunk_index}")
        print("Metadata:", chunk.metadata_json)
        print("Content:", chunk.content[:300])
        print("-" * 50)

finally:
    db.close()
