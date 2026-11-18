from database.connection import SessionLocal
from ai_engine.retrieval.semantic_search import semantic_search

db = SessionLocal()

try:
    query = "What technical skills and programming languages are mentioned in this resume?"

    results = semantic_search(query, db, top_k=5)

    print("\n========== RETRIEVED RESULTS ==========")

    for index, result in enumerate(results, start=1):
        print(f"\nRank: {index}")
        print(f"Similarity: {result['similarity']:.4f}")
        print(f"Content: {result['content'][:500]}")
        print("-" * 60)

    print(f"\nTotal results: {len(results)}")

finally:
    db.close()
