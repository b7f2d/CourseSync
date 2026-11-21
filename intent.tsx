import { Intent, Script } from "scripting";
import { launchCourseSync } from "./index";

Promise.resolve(launchCourseSync()).catch(error => {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,60}$/.test(error.code)
    ? error.code : 'INTENT_LAUNCH_FAILED';
  console.error('[CourseSync] Intent launch failed: ' + code);
  Script.exit(Intent.text('刷新失败：' + code));
});
