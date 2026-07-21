import os
from pathlib import Path

# Must run before app/config imports so Settings picks up test values.
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["CHROMA_PERSIST_DIR"] = "./test_chroma"

Path("test.db").unlink(missing_ok=True)
# Wipe previous test chroma
import shutil
shutil.rmtree("test_chroma", ignore_errors=True)
