from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("blender_video_organ", HERE / "blender_video_organ.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

if len(sys.argv) != 3:
    raise SystemExit("usage: integration_blender_video.py sha256:<digest> output.json")

address = sys.argv[1]
output = Path(sys.argv[2])
organ = module.BlenderVideoOrgan(13704)

status = organ.status()
if status.get("connected") is not True:
    raise SystemExit(f"Haunted Blender resolver not connected: {status}")

resolved = organ.resolve(address)
output.write_text(json.dumps(resolved, indent=2) + "\n", encoding="utf-8")
print(f"Resolved {address} through the Haunted Blender organ.")
