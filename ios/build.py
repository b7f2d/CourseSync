# SPDX-License-Identifier: GPL-3.0-only
import argparse
from pathlib import Path
import plistlib
import json
import re
import subprocess
import zipfile
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tools", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    sdk = args.tools / "iPhoneOS26.5.sdk" if args.tools else Path(subprocess.check_output(["xcrun", "--sdk", "iphoneos", "--show-sdk-path"], text=True).strip())
    binaries = args.tools / "toolchain/windows/iphone/bin" if args.tools else None
    app = source / "build/Payload/CourseSync.app"
    app.mkdir(parents=True, exist_ok=True)
    core = (source.parent / "index.tsx").read_text(encoding="utf-8")
    core, count = re.subn(r"^import .*?;\n", "", core, flags=re.M)
    if count != 4:
        raise ValueError("Unexpected CourseSync entry point imports")
    # A fresh app container cannot prove ownership of existing calendar entries.
    legacy_cleanup = "const REPLACE_DEDICATED_LEGACY = true;"
    if core.count(legacy_cleanup) != 1:
        raise ValueError("Could not disable legacy calendar cleanup for the standalone app")
    core = core.replace(legacy_cleanup, "const REPLACE_DEDICATED_LEGACY = false;")
    core = core.replace("    stampStage(state,store,message);", "    stampStage(state,store,message);\n    native('progress',{value:message});")
    core = core.replace("在 Scripting", "在 CourseSync").replace("给 Scripting", "给 CourseSync")
    core = core.replace("更新 Scripting 后", "更新 CourseSync 后").replace("Scripting 原生学校", "CourseSync 原生学校")
    host = (source / "host.js").read_text(encoding="utf-8")
    (app / "CourseSync.js").write_text(host + "\n" + core, encoding="utf-8")
    frameworks = ["UIKit", "Foundation", "CoreGraphics", "JavaScriptCore", "EventKit", "Security", "UserNotifications", "WebKit"]
    obj = source / "build/main.o"
    subprocess.run([
        str(binaries / "clang.exe") if binaries else "clang", "-target", "arm64-apple-ios17.0", "-isysroot", str(sdk),
        "-fobjc-arc", "-Wno-incompatible-pointer-types", "-c", str(source / "main.m"), "-o", str(obj),
    ], check=True)
    command = [
        str(binaries / "lld.exe") if binaries else "ld", "-flavor", "darwin", "-arch", "arm64",
        "-platform_version", "ios", "17.0", "26.5", "-syslibroot", str(sdk), "-no_adhoc_codesign",
        "-lSystem", "-lobjc", str(obj), "-o", str(app / "CourseSync"),
    ]
    for framework in frameworks:
        command += ["-framework", framework]
    if not binaries:
        command = ["xcrun", "--sdk", "iphoneos", "clang", "-target", "arm64-apple-ios17.0", "-isysroot", str(sdk), str(obj), "-o", str(app / "CourseSync")]
        for framework in frameworks:
            command += ["-framework", framework]
    subprocess.run(command, check=True)
    info = {
        "CFBundleExecutable": "CourseSync",
        "CFBundleDevelopmentRegion": "zh_CN",
        "CFBundleIdentifier": "com.b7f2d.coursesync.standalone",
        "CFBundleName": "CourseSync",
        "CFBundleDisplayName": "CourseSync",
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": json.loads((source.parent / "script.json").read_text(encoding="utf-8"))["version"],
        "CFBundleVersion": json.loads((source.parent / "script.json").read_text(encoding="utf-8"))["version"],
        "CFBundleSupportedPlatforms": ["iPhoneOS"],
        "MinimumOSVersion": "17.0",
        "UIDeviceFamily": [1],
        "UILaunchScreen": {},
        "NSCalendarsFullAccessUsageDescription": "CourseSync 需要核对并更新专用课表日历中的课程。",
    }
    (app / "Info.plist").write_bytes(plistlib.dumps(info))
    (app / "LICENSE").write_bytes((source.parent / "LICENSE").read_bytes())
    with zipfile.ZipFile(args.output, "x", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(app.iterdir()):
            name = path.relative_to(app.parent.parent).as_posix()
            entry = zipfile.ZipInfo(name)
            entry.create_system = 3
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = (0o100755 if path.name == "CourseSync" else 0o100644) << 16
            archive.writestr(entry, path.read_bytes())


if __name__ == "__main__":
    main()
