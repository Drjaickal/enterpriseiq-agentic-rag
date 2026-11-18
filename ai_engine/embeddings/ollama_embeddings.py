import httpx


class OllamaEmbeddingClient:
    def __init__(
        self,
        model="nomic-embed-text",
        base_url="http://localhost:11434",
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        response = httpx.post(
            f"{self.base_url}/api/embed",
            json={
                "model": self.model,
                "input": texts,
                "keep_alive": "30m",
            },
            timeout=120.0,
        )

        response.raise_for_status()

        embeddings = response.json()["embeddings"]

        if len(embeddings) != len(texts):
            raise ValueError("Embedding count mismatch")

        if any(len(vector) != 768 for vector in embeddings):
            raise ValueError("Unexpected embedding dimensions")

        return embeddings

    def embed_query(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]
