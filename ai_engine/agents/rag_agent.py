
import os
import re
from time import perf_counter

import httpx
from google import genai
from google.genai import types
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

    provider = os.getenv("GENERATION_PROVIDER", "ollama").lower()

    if provider == "gemini":
        model = os.getenv(
            "GEMINI_GENERATION_MODEL",
            "gemini-3.8-flash",
        )
    elif provider == "ollama":
        model = os.getenv(
            "OLLAMA_GENERATION_MODEL",
            "qwen2.5:3b",
        )
    else:
        raise ValueError(
            f"Unsupported generation provider: {provider}"
        )

    retrieval_start = perf_counter()

    retrieved_chunks = semantic_search(
        query=query.strip(),
        db=db,
        top_k=top_k,
    )

    retrieval_time = perf_counter() - retrieval_start
    print(f"[RAG TIMING] Retrieval: {retrieval_time:.3f}s")

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
You are EnterpriseIQ, an enterprise-grade document
question-answering assistant.

Your responsibility is to provide accurate, complete,
clear, and useful answers based strictly on the
provided document context.

GROUNDING RULES:
1. Use ONLY information from the supplied context.
2. Never invent facts, names, dates, figures, or events.
3. If information is unavailable, explicitly say so.
4. Cite factual claims using [Source N].
5. Use only the source numbers provided in the context.
6. Never cite a source that does not support the claim.

ANSWER QUALITY RULES:
1. Answer the user's actual question directly.
2. Explain important details rather than giving vague statements.
3. Use headings and bullet points when appropriate.
4. For summaries, provide the requested number of points.
5. Include relevant names, activities, dates, and figures
   when available in the context.
6. Avoid unnecessary repetition.
7. Never stop after an incomplete sentence.
8. Return a complete, readable answer.

If the document does not contain enough information,
clearly explain what could not be established.

Return only the final answer.
"""

    user_prompt = f"""
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

    generation_start = perf_counter()

    try:
        if provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")

            if not api_key:
                raise ValueError("GEMINI_API_KEY is not configured")

            client = genai.Client(api_key=api_key)

            response = client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.1,
                    max_output_tokens=512,
                ),
            )

            answer = (response.text or "").strip()

        else:
            base_url = os.getenv(
                "OLLAMA_BASE_URL",
                "http://localhost:11434",
            ).rstrip("/")

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
            data = response.json()

            print(
                "[OLLAMA METRICS]",
                {
                    key: round(
                        data.get(key, 0) / 1_000_000_000, 3
                    )
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

        generation_time = perf_counter() - generation_start

        print(
            f"[RAG TIMING] Generation: {generation_time:.3f}s"
        )

    except Exception as exc:
        raise RuntimeError(
            f"Could not generate an answer using {provider}: {exc}"
        ) from exc

    if not answer:
        raise RuntimeError(
            f"{provider} returned an empty answer."
        )

    # Remove invalid source references if the model invents them.
    valid_source_numbers = set(range(1, len(sources) + 1))

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
