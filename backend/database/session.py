from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from config import settings
from .models import Base

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _add_column(table: str, column: str, coltype: str) -> None:
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.begin() as conn:
        if is_sqlite:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            names = {r[1] for r in rows}
            if column not in names:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))
        else:
            conn.execute(
                text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coltype}"
                )
            )


def migrate_schema() -> None:
    """Add VeriSight columns to existing SQLite/Postgres databases."""
    try:
        _add_column("cases", "case_number", "VARCHAR(64)")
        _add_column("cases", "priority", "VARCHAR(20)")
        _add_column("cases", "assigned_investigator", "VARCHAR(255)")
        _add_column("cases", "incident_time", "DATETIME")
        _add_column("cameras", "zone", "VARCHAR(255)")
        _add_column("cameras", "map_angle", "FLOAT")
        _add_column("cameras", "map_fov", "FLOAT")
        _add_column("detections", "false_positive_reason", "TEXT")
        _add_column("annotations", "tags", "JSON")
    except Exception:
        pass


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    migrate_schema()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
