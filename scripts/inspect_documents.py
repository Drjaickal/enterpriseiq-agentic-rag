from database.connection import SessionLocal
from database.models import Document, DocumentChunk
from sqlalchemy import select, func

db = SessionLocal()

try:
    documents = db.scalars(select(Document)).all()

    print("\n========== STORED DOCUMENTS ==========")

    for document in documents:
        count = db.scalar(
            select(func.count(DocumentChunk.id))
            .where(DocumentChunk.document_id == document.id)
        )

        print(f"\nFilename: {document.filename}")
        print(f"Document ID: {document.id}")
        print(f"File type: {document.file_type}")
        print(f"Total chunks: {count}")
        print("-" * 60)

finally:
    db.close()
