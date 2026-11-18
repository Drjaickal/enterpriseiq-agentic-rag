
import os

from google import genai
from google.genai import types


class GeminiEmbeddingClient:
    def __init__(self, model: str = "gemini-embedding-001"):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured")

        self.client = genai.Client(api_key=api_key)
        self.model = model

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        response = self.client.models.embed_content(
            model=self.model,
            contents=texts,
            config=types.EmbedContentConfig(
                output_dimensionality=768
            ),
        )

        embeddings = [
            item.values for item in response.embeddings
        ]

        if len(embeddings) != len(texts):
            raise ValueError("Embedding count mismatch")

        if any(len(vector) != 768 for vector in embeddings):
            raise ValueError("Unexpected embedding dimensions")

        return embeddings

    def embed_query(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]
