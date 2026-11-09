#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
destination="${1:-dist}"
mkdir -p "$destination"
output="$destination/CourseSync.zip"
rm -f "$output"
zip -q -X -j "$output" index.tsx intent.tsx widget.tsx widget-data.ts login-native.tsx progress-native.tsx live_activity.tsx script.json
test "$(unzip -Z1 "$output" | wc -l | tr -d " ")" = "8"
unzip -t "$output"
# Verify the published archive contains exactly the intended entry points and
# that its embedded metadata matches the repository source.
python3 - "$output" <<'PY'
import json
from pathlib import Path
import sys
from zipfile import ZipFile

expected_files = {
    "index.tsx", "intent.tsx", "widget.tsx", "widget-data.ts",
    "login-native.tsx", "progress-native.tsx", "live_activity.tsx",
    "script.json",
}
with ZipFile(sys.argv[1]) as archive:
    if set(archive.namelist()) != expected_files:
        raise SystemExit("ZIP entry list differs from expected Scripting files")
    packed = json.loads(archive.read("script.json"))
    source = json.loads(Path("script.json").read_text(encoding="utf-8"))
    if packed != source:
        raise SystemExit("ZIP metadata is inconsistent with repository script.json")
print("Verified CourseSync ZIP entries and metadata")
PY
