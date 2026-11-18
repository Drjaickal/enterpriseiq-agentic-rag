
from dotenv import load_dotenv

from ai_engine.embeddings.gemini_embeddings import (
    GeminiEmbeddingClient,
)

load_dotenv()

client = GeminiEmbeddingClient()

text = "EnterpriseIQ is an agentic RAG platform."

embedding = client.embed_query(text)

print("Gemini embedding test successful!")
print("Embedding dimensions:", len(embedding))
print("First 5 values:", embedding[:5])
