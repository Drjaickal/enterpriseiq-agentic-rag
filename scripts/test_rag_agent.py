from database.connection import SessionLocal
from ai_engine.agents.rag_agent import answer_question

db = SessionLocal()

try:
    result = answer_question(
        query="What technical skills and programming languages are mentioned in this resume?",
        db=db,
        top_k=5,
    )

    print("\n========== ENTERPRISEIQ ANSWER ==========")
    print(result["answer"])

    print("\n========== SOURCES ==========")
    for source in result["sources"]:
        print(source)

    print("\nModel:", result["model"])
    print("Retrieved chunks:", result["retrieved_chunks"])

finally:
    db.close()
