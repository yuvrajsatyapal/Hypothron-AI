"""Export the implemented API schema without connecting to a database or provider."""

import json
import sys
from pathlib import Path

from hypothron.api import create_app

root = Path(__file__).resolve().parent.parent
path = root / "packages/contracts/openapi-v1.json"
app = create_app(database_url="postgresql+psycopg://contract-export.invalid/hypothron")
source = json.dumps(app.openapi(), sort_keys=True, indent=2) + "\n"
if "--check" in sys.argv:
    if not path.exists() or path.read_text() != source:
        raise SystemExit(
            "API schema differs: run services/api/.venv/bin/python scripts/export-api-contracts.py"
        )
else:
    path.write_text(source)
print("API contract matches implemented routes")
