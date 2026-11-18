from time import perf_counter
import os
import re

import httpx
from sqlalchemy.orm import Session

from ai_engine.retrieval.semantic_search import semantic_search


def answer_question(
    query: str,
    db: Session,
    top_k: int = 5,
) -> dict:
    """Retrieve relevant chunks and generate a grounded answer."""

    if not query or not query.strip():
        raise ValueError("Question cannot be empty.")

    if top_k < 1:
        raise ValueError("top_k must be at least 1.")

    retrieval_start = perf_counter()

    retrieved_chunks = semantic_search(
    query=query.strip(),
    db=db,
    top_k=top_k,
)

    retrieval_time = perf_counter() - retrieval_start
    print(f"[RAG TIMING] Retrieval: {retrieval_time:.3f}s")

    model = os.getenv(
        "OLLAMA_GENERATION_MODEL",
        "qwen2.5:3b",
    )

    if not retrieved_chunks:
        return {
            "answer": (
                "I could not find relevant information "
                "in the uploaded documents."
            ),
            "sources": [],
            "model": model,
            "retrieved_chunks": 0,
        }

    context_parts = []
    sources = []

    for index, chunk in enumerate(retrieved_chunks, start=1):
        source_id = (
            f"Document {chunk['document_id']} "
            f"- Chunk {chunk['chunk_index']}"
        )

        context_parts.append(
            f"[Source {index}: {source_id}]\n"
            f"{chunk['content']}"
        )

        sources.append({
            "source_id": source_id,
            "document_id": chunk["document_id"],
            "chunk_index": chunk["chunk_index"],
            "similarity": round(
                float(chunk["similarity"]), 4
            ),
        })

    context = "\n\n".join(context_parts)
    print(f"[RAG TIMING] Context size: {len(context)} characters")
    print(f"[RAG TIMING] Retrieved sources: {len(sources)}")

    system_prompt = """
You are EnterpriseIQ, an enterprise document
question-answering assistant.

Answer using ONLY the supplied document context.

STRICT RULES:
1. Never use outside knowledge.
2. Never invent facts or qualifications.
3. If information is missing, say so clearly.
4. Keep the answer concise and structured.
5. Cite every factual statement using the supplied
   source labels, such as [Source 1].
6. A statement may cite multiple sources, such as
   [Source 1][Source 2].
7. Only cite sources that support the statement.
8. Never invent source numbers.
9. Return only the final answer.
10. Never reveal reasoning or internal analysis.
"""

    user_prompt = f"""/no_think

Answer the question using the supplied document context.

Every factual sentence or bullet must end with
at least one relevant citation in the format [Source N].

If the context does not contain the answer, clearly
state that the information was not found.

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{query.strip()}

FINAL ANSWER:
"""

    base_url = os.getenv(
        "OLLAMA_BASE_URL",
        "http://localhost:11434",
    ).rstrip("/")

    generation_start = perf_counter()
    try:
        response = httpx.post(
            f"{base_url}/api/chat",
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                "stream": False,
                "think": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 250,
                    "repeat_penalty": 1.1,
                },
            },
            timeout=httpx.Timeout(
                300.0,
                connect=10.0,
            ),
        )

        response.raise_for_status()
        generation_time = perf_counter() - generation_start
        print(f"[RAG TIMING] Generation: {generation_time:.3f}s")

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Could not generate an answer using Ollama: {exc}"
        ) from exc

    data = response.json()
    print(
    "[OLLAMA METRICS]",
    {
        key: round(data.get(key, 0) / 1_000_000_000, 3)
        for key in (
            "load_duration",
            "prompt_eval_duration",
            "eval_duration",
            "total_duration",
        )
    },
)
    answer = data.get("message", {}).get(
        "content", ""
    ).strip()

    if not answer:
        raise RuntimeError(
            f"Ollama returned an empty answer. Response: {data}"
        )

    # Remove invalid source references if the model invents them.
    valid_source_numbers = set(
        range(1, len(sources) + 1)
    )

    def validate_citation(match):
        number = int(match.group(1))

        if number in valid_source_numbers:
            return match.group(0)

        return ""

    answer = re.sub(
        r"\[Source\s+(\d+)\]",
        validate_citation,
        answer,
    )

    return {
        "answer": answer.strip(),
        "sources": sources,
        "model": model,
        "retrieved_chunks": len(retrieved_chunks),
    }
