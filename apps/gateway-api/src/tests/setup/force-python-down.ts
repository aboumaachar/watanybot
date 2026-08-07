import { setPythonBase, getPythonBase } from "../../lib/config";

// Test-only helper: provide explicit functions to force the Python upstream
// to an unreachable local URL and to restore the previous environment.
// IMPORTANT: this module no longer mutates `process.env` at import time —
// callers must invoke `forcePythonDown()` explicitly so side-effects are
// localized to the test that needs them.

let ORIGINAL_PYTHON_API_URL: string | undefined;
let ORIGINAL_PYTHON_UP: string | undefined;
let ORIGINAL_PYTHON_BASE: string | undefined;

export function forcePythonDown(): void {
  // Capture originals lazily so multiple calls won't clobber the saved state
  if (ORIGINAL_PYTHON_BASE === undefined) {
    ORIGINAL_PYTHON_API_URL = process.env.PYTHON_API_URL;
    ORIGINAL_PYTHON_UP = process.env.PYTHON_UP;
    ORIGINAL_PYTHON_BASE = getPythonBase();

    process.env.PYTHON_API_URL = "http://127.0.0.1:9";
    delete process.env.PYTHON_UP;
    setPythonBase("http://127.0.0.1:9");
  }
}

export function restorePythonEnv(): void {
  if (ORIGINAL_PYTHON_API_URL === undefined) {
    delete process.env.PYTHON_API_URL;
  } else {
    process.env.PYTHON_API_URL = ORIGINAL_PYTHON_API_URL;
  }

  if (ORIGINAL_PYTHON_UP === undefined) {
    delete process.env.PYTHON_UP;
  } else {
    process.env.PYTHON_UP = ORIGINAL_PYTHON_UP;
  }

  if (ORIGINAL_PYTHON_BASE !== undefined) {
    setPythonBase(ORIGINAL_PYTHON_BASE);
  }

  ORIGINAL_PYTHON_API_URL = undefined;
  ORIGINAL_PYTHON_UP = undefined;
  ORIGINAL_PYTHON_BASE = undefined;
}

export default undefined;
