// CourseSync — Shortcuts intent entry.
// The imported sync module starts its run immediately; explicitly await that
// Promise so this entry does not resolve before calendar sync and final cleanup.
import "./index";

await globalThis.__COURSESYNC_LAUNCH__;
