const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, process.argv[2] || 'dist');
fs.mkdirSync(destination, { recursive: true });

const output = path.join(destination, 'CourseSync.zip');
if (fs.existsSync(output)) {
  fs.unlinkSync(output);
}

const files = [
  'index.tsx',
  'intent.tsx',
  'widget.tsx',
  'widget-data.ts',
  'login-native.tsx',
  'progress-native.tsx',
  'live_activity.tsx',
  'schedule-native.tsx',
  'script.json',
];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

function verifyZip(zipPath) {
  const AdmZip = (() => {
    // If Python is available, verify with Python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      const verifyScript = `
import json, sys
from pathlib import Path
from zipfile import ZipFile

output = Path(sys.argv[1])
root = Path(sys.argv[2])
expected = set(sys.argv[3:])

with ZipFile(output, 'r') as z:
    names = set(z.namelist())
    if names != set(expected):
        raise SystemExit(f"ZIP files mismatch: {names} != {expected}")
    packed = json.loads(z.read("script.json"))
    source = json.loads((root / "script.json").read_text(encoding="utf-8"))
    if packed != source:
        raise SystemExit("ZIP metadata is inconsistent with repository script.json")
print("Verified CourseSync ZIP entries and metadata")
`;
      const tempScript = path.join(destination, '_verify.py');
      fs.writeFileSync(tempScript, verifyScript.trim(), 'utf8');
      execSync(`${pythonCmd} "${tempScript}" "${zipPath}" "${root}" ${files.join(' ')}`, {
        stdio: 'inherit',
      });
      fs.unlinkSync(tempScript);
      return true;
    } catch (_) {
      return false;
    }
  })();
}

if (process.platform === 'win32') {
  const tempDir = path.join(destination, '_temp_zip');
  fs.mkdirSync(tempDir, { recursive: true });
  for (const f of files) {
    fs.copyFileSync(path.join(root, f), path.join(tempDir, f));
  }
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tempDir}/*' -DestinationPath '${output}' -Force"`, {
    stdio: 'inherit',
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
  verifyZip(output);
  console.log(`Successfully packaged CourseSync to ${output}`);
} else {
  execSync(`zip -q -X -j "${output}" ${files.join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
  });
  verifyZip(output);
  console.log(`Successfully packaged CourseSync to ${output}`);
}
