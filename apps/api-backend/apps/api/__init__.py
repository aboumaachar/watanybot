from pathlib import Path
import sys


# Preserve the existing local-import style while allowing `uvicorn apps.api.main:app`
# to run from the workspace root or the backend root.
_PACKAGE_DIR = Path(__file__).resolve().parent
_PACKAGE_DIR_STR = str(_PACKAGE_DIR)
if _PACKAGE_DIR_STR not in sys.path:
    sys.path.insert(0, _PACKAGE_DIR_STR)