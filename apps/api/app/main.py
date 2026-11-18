from pathlib import Path
from uuid import uuid4

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Document, DocumentChunk
from ai_engine.ingestion.ingestion_service import ingest_document
from ai_engine.agents.rag_agent import answer_question


PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_DIR = PROJECT_ROOT / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 20 * 1024 * 1024


app = FastAPI(
    title="EnterpriseIQ API",
    description="Enterprise Knowledge Intelligence Platform",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://enterpriseiq-agentic-rag.vercel.app",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=3, ge=1, le=10)


@app.get("/")
def root():
    return {
        "project": "EnterpriseIQ",
        "message": "Enterprise Knowledge Intelligence API",
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "enterpriseiq-api",
        "version": "0.2.0",
    }


@app.get("/api/v1/stats")
def get_stats(db: Session = Depends(get_db)):
    total_documents = db.query(Document).count()
    indexed_chunks = db.query(DocumentChunk).count()

    return {
        "status": "success",
        "total_documents": total_documents,
        "indexed_chunks": indexed_chunks,
    }

@app.get("/api/v1/documents")
def get_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(
        Document.created_at.desc()
    ).all()

    return {
        "status": "success",
        "documents": [
            {
                "id": str(document.id),
                "filename": document.filename,
                "file_type": document.file_type,
                "created_at": document.created_at.isoformat()
                if document.created_at else None,
                "total_chunks": len(document.chunks),
            }
            for document in documents
        ],
    }


@app.post("/api/v1/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    try:
        result = answer_question(
            query=request.question,
            db=db,
            top_k=request.top_k,
        )
        return {
            "status": "success",
            "question": request.question,
            **result,
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Chat request failed: {str(exc)}",
        )


@app.post("/api/v1/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    original_name = Path(file.filename).name
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOCX and TXT files are supported.",
        )

    contents = file.file.read(MAX_FILE_SIZE + 1)

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum upload size is 20 MB.",
        )

    stored_name = f"{uuid4().hex}{extension}"
    saved_path = UPLOAD_DIR / stored_name

    try:
        saved_path.write_bytes(contents)

        result = ingest_document(
            file_path=saved_path,
            db=db,
        )

        return {
            **result,
            "original_filename": original_name,
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document ingestion failed: {str(exc)}",
        )
