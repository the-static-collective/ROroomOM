from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("vault_media_organ", HERE / "vault_media_organ.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

if len(sys.argv) != 3:
    raise SystemExit("usage: integration_vault_media.py sha256:<digest> output.json")

address = sys.argv[1]
output = Path(sys.argv[2])
organ = module.VaultMediaOrgan(13703)

status = organ.status()
if status.get("connected") is not True:
    raise SystemExit(f"Vault resolver not connected: {status}")

resolved = organ.resolve(address)
output.write_text(json.dumps(resolved, indent=2) + "\n", encoding="utf-8")
print(f"Resolved {address} through the Vault organ.")
