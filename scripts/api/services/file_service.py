from __future__ import annotations

import subprocess


def validate_js_override(content: str, *, node_bin: str = "node", timeout: int = 10) -> tuple[bool, str]:
    script = str(content or "").strip()
    if not script:
        return False, "script is empty"

    js_checker = r"""
const fs = require("fs");
const code = fs.readFileSync(0, "utf8");
try {
  const runner = new Function(
    code +
      "\nif (typeof main !== 'function') { throw new Error('override.js must define main(config)'); }\nreturn true;"
  );
  runner();
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(2);
}
"""
    try:
        result = subprocess.run(
            [node_bin, "-e", js_checker],
            input=script,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        return False, "node runtime not found"
    except subprocess.TimeoutExpired:
        return False, "javascript validation timeout"

    if result.returncode != 0:
        return False, (result.stderr.strip() or "javascript parse error")
    return True, ""

