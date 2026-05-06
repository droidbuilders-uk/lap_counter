from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# We will use SQLite for simplicity and because it runs perfectly on the Pi
SQLALCHEMY_DATABASE_URL = "sqlite:///./lap_counter.db"

# check_same_thread=False is needed for SQLite when accessed from multiple threads
# (e.g. FastAPI route handlers and the background camera thread)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
