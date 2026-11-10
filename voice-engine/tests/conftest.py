"""Make ``santa_voice_v2`` importable whatever directory pytest runs from."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
