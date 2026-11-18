from database.connection import Base, engine
from database import models


def initialize_database():
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE EXTENSION IF NOT EXISTS vector"
        )

    Base.metadata.create_all(bind=engine)

    print("EnterpriseIQ database initialized successfully!")


if __name__ == "__main__":
    initialize_database()
