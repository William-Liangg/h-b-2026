"""Database connection and models."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import DATABASE_URL

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # nullable for OAuth-only users
    github_id = Column(String(50), unique=True, nullable=True, index=True)
    github_access_token = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def init_db():
    Base.metadata.create_all(bind=engine)
    # Add github_access_token column if missing (lightweight migration)
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "github_access_token" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN github_access_token VARCHAR(255)"))



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
