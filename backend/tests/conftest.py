import os

# Must run before app/config imports so Settings picks up the test DB.
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from pathlib import Path

# Fresh DB each session
Path("test.db").unlink(missing_ok=True)
