// Public-facing metadata and documentation invariants; no Scripting host required.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Scripting metadata keeps the intended display identity',()=>{
  const data=JSON.parse(read('script.json'));
  assert.equal(data.name,'CourseSync');
  assert.equal(Object.hasOwn(data,'version'),false);
  assert.equal(data.description,JSON.parse(read('package.json')).description);
  for(const feature of ['Apple 日历','空闲教室','快捷指令'])
    assert.ok(data.description.includes(feature));
  assert.equal(data.localizedNames.en,'CourseSync');
  assert.equal(data.localizedNames.zh,'CourseSync');
  assert.match(data.color,/^#[0-9a-fA-F]{6}$/);
  assert.equal(data.icon,'calendar');
});

test('script identity is independent of the selected school',()=>{
  assert.doesNotMatch(read('script.json'),/南京财经大学|苏州科技大学|南财/);
});

test('README uses the same label as the installed script',()=>{
  const readme=read('README.md');
  assert.match(readme,/^# CourseSync$/m);
  assert.match(readme,/打开 \*\*CourseSync\*\*/);
});

test('README describes NUFE as the only currently open school',()=>{
  assert.match(read('README.md'),/南京财经大学的 iPhone 课表工具/);
  assert.doesNotMatch(read('README.md'),/苏州科技大学/);
  assert.match(read('README.md'),/输入学校学号和密码/);
});

test('README remains text-only without image markup or references',()=>{
  const readme=read('README.md');
  assert.equal(readme.includes('<img'),false);
  assert.equal(readme.includes('<picture'),false);
  assert.equal(readme.includes('<svg'),false);
  assert.equal(readme.includes('docs/images/'),false);
  assert.equal(readme.includes('!['),false);
  assert.match(readme,/已同步到 Apple 日历的课程和考试仍可查看/);
});

test('README points to the main branch for remote import',()=>{
  const url='https://github.com/b7f2d/CourseSync/tree/main';
  assert.ok(read('README.md').includes(url));
});

test('error guidance does not direct users to removed menu actions',()=>{
  const source=read('index.tsx');
  const start=source.indexOf('const ERROR_GUIDE={');
  const end=source.indexOf('function diagnosticCode(',start);
  assert.ok(start>=0&&end>start);
  const guide=source.slice(start,end);
  assert.doesNotMatch(guide,/登录页面自检（无需密码）|重试「覆盖旧课程」|从菜单执行历史课程清理|选择「重新绑定课表日历」|运行状态/);
  assert.doesNotMatch(guide,/账号与日历设置/);
  assert.match(guide,/主菜单「立即刷新」/);
});

test('CI validates the remote script without packaging or publishing',()=>{
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/release.yml')),false);
  assert.equal(fs.existsSync(path.join(root,'scripts/package.sh')),false);
  assert.equal(fs.existsSync(path.join(root,'scripts/package.cjs')),false);
  assert.equal(Object.hasOwn(JSON.parse(read('package.json')).scripts,'package'),false);
  assert.match(read('.github/workflows/validate.yml'),/node --test tests\/\*\.test\.cjs/);
});

test('remote distribution contains only the active entry points',()=>{
  assert.equal(fs.existsSync(path.join(root,'widget.tsx')),false);
  assert.equal(fs.existsSync(path.join(root,'widget-data.ts')),false);
  assert.doesNotMatch(read('script.json')+read('README.md')+read('package.json'),/小组件|widget/i);
  const index=read('index.tsx');
  assert.doesNotMatch(index,/widgetCacheProjection|publishWidgetCache|reloadUserWidgets|hostAPI\('Widget'\)/);
  assert.equal(index.includes("from './login-native'"),false);
  assert.equal(index.includes("from './progress-native'"),false);
  assert.equal(index.includes("from './live_activity'"),false);
  assert.ok(index.includes("await import('./login-native')"));
  assert.equal(index.includes("await import('./progress-native')"),false);
  const intent=read('intent.tsx');
  assert.ok(intent.includes('import { launchCourseSync } from "./index"'));
  assert.ok(intent.includes('Promise.resolve().then(() => launchCourseSync()).catch('));
  assert.ok(intent.includes('launchCourseSync()'));
  assert.doesNotMatch(intent,/live_activity|loadActivity/);
  assert.equal(fs.existsSync(path.join(root,'live_activity.tsx')),false);
  assert.equal(intent.includes('await globalThis.__COURSESYNC_LAUNCH__'),false);
  assert.ok(intent.includes('Script.exit(Intent.text('));
  assert.ok(index.includes('export function launchCourseSync()'));
  assert.ok(index.includes("const __bootScript = Scripting.Script ?? globalThis.Script;"));
  assert.ok(index.includes("__bootScript?.env !== 'intent'"));
  assert.ok(index.includes("__shortcutOutput||'处理完成'"));
  const intentBody=intent.split('\n').filter(line=>!line.trimStart().startsWith('import ')).join('\n');
  assert.doesNotThrow(()=>new (require('node:vm').Script)(intentBody));
});
